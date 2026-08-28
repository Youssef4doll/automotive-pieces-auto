"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { toNumber } from "@/lib/money";
import { computeSegment } from "@/lib/segment";

const itemSchema = z.object({
  productId: z.string(),
  qty: z.number().int().positive(),
});

const placeOrderSchema = z.object({
  customerName: z.string().min(2),
  phone: z.string().min(6),
  email: z.email().optional().or(z.literal("")),
  governorate: z.string().min(2),
  address: z.string().optional(),
  deliveryMethod: z.enum(["DELIVERY", "PICKUP"]),
  paymentMethod: z.enum(["COD", "CARD"]),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
  // First-touch marketing attribution, read client-side from localStorage
  // at submit time — see lib/attribution.ts. Never trusted for anything
  // but reporting (it doesn't affect price, stock, or order validity), so
  // it's fine that a client could send anything here.
  source: z.string().optional(),
  medium: z.string().optional(),
  campaign: z.string().optional(),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type PlaceOrderResult = { ok: true; ref: string } | { ok: false; error: string };

// Thrown for expected business-rule failures inside the transaction (out of
// stock, deleted product) so we can turn them into a friendly error and roll
// back cleanly — anything else (a real bug, a DB outage) propagates instead
// of being swallowed as if it were the customer's fault.
class OrderError extends Error {}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const data = parsed.data;

  if (data.paymentMethod === "CARD") {
    return { ok: false, error: "Le paiement par carte arrive bientôt — choisissez le paiement à la livraison." };
  }

  const settings = await getSettings();
  const freeShippingThreshold = Number(settings.free_shipping_threshold) || 150;
  const user = await getCurrentUser();

  // Two simultaneous checkouts can read the same MAX(ref) and try to write
  // the same reference. The unique index makes that fail loudly rather than
  // duplicate, so retry a couple of times before surfacing an error.
  const MAX_REF_ATTEMPTS = 4;
  for (let attempt = 1; ; attempt++) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Price and stock are read fresh inside the transaction — the client
      // only ever sends productId + qty, never a price, so there's nothing
      // for a tampered request to override here.
      const productIds = data.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: { images: { orderBy: { order: "asc" }, take: 1, select: { id: true } } },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      const lineItems = data.items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) throw new OrderError("Un produit du panier n'existe plus.");
        const unitPrice = toNumber(product.priceSell);
        return {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          // Snapshot the photo the shopper actually saw, not the generic
          // catalogue placeholder sitting in the imageUrl column.
          imageUrl: product.images[0] ? `/api/images/${product.images[0].id}` : product.imageUrl,
          unitPrice,
          qty: item.qty,
          lineTotal: unitPrice * item.qty,
        };
      });

      // Claim stock atomically per item: the `stockQty: { gte: item.qty }`
      // guard means the decrement only applies if enough stock is *still*
      // there at the moment of the write. Checking stockQty earlier and
      // decrementing later (the previous version of this code) left a gap
      // where two concurrent checkouts for the last unit could both pass
      // the check and both decrement — overselling and driving stock
      // negative. `updateMany`'s matched count tells us which case we're in.
      for (const item of data.items) {
        const product = productMap.get(item.productId)!;
        const { count } = await tx.product.updateMany({
          where: { id: item.productId, stockQty: { gte: item.qty } },
          data: { stockQty: { decrement: item.qty } },
        });
        if (count === 0) {
          throw new OrderError(`Stock insuffisant pour ${product.name} (${product.stockQty} disponible(s)).`);
        }
      }

      const subtotal = lineItems.reduce((s, l) => s + l.lineTotal, 0);
      const shippingFee =
        data.deliveryMethod === "PICKUP" ? 0 : subtotal >= freeShippingThreshold ? 0 : 8;
      const total = subtotal + shippingFee;

      // Derive the reference from the highest existing one, never from
      // row count. count() breaks permanently the first time any order is
      // deleted or cancelled-and-purged: this database had 24 orders while
      // the highest ref was CMD-1041, so count+1001 landed on a ref that
      // already existed and EVERY checkout failed with a unique-constraint
      // 500. Parsed numerically in SQL so it stays correct past CMD-9999,
      // where a lexicographic max would start returning the wrong row.
      const [{ max }] = await tx.$queryRaw<{ max: number }[]>`
        SELECT COALESCE(MAX(CAST(SUBSTRING(ref FROM '[0-9]+$') AS INTEGER)), 1000) AS max
        FROM "Order"
      `;
      const ref = `CMD-${Number(max) + 1}`;

      const order = await tx.order.create({
        data: {
          ref,
          userId: user?.id,
          customerName: data.customerName,
          phone: data.phone,
          email: data.email || undefined,
          governorate: data.governorate,
          address: data.address,
          deliveryMethod: data.deliveryMethod,
          paymentMethod: data.paymentMethod,
          status: "PENDING",
          source: data.source,
          medium: data.medium,
          campaign: data.campaign,
          subtotal,
          shippingFee,
          total,
          notes: data.notes,
          items: { create: lineItems },
          history: { create: { status: "PENDING" } },
        },
      });

      for (const item of data.items) {
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            change: -item.qty,
            reason: "order",
            note: `Commande ${ref}`,
          },
        });
      }

      // Keep the stored segment truthful — see lib/segment.ts. Guest
      // checkouts (no account) have nothing to update here.
      if (user) {
        const priorOrders = await tx.order.findMany({
          where: { userId: user.id, status: { not: "CANCELLED" } },
          select: { total: true },
        });
        const completedCount = priorOrders.length + 1; // + the order just created
        const totalSpent = priorOrders.reduce((s, o) => s + toNumber(o.total), 0) + total;
        await tx.user.update({
          where: { id: user.id },
          data: { segment: computeSegment(completedCount, totalSpent) },
        });
      }

      return order;
    });

    return { ok: true, ref: result.ref };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.message };
    const isRefCollision =
      typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
    if (isRefCollision && attempt < MAX_REF_ATTEMPTS) continue;
    throw e;
  }
  }
}

export async function getOrderByRef(ref: string) {
  return prisma.order.findUnique({
    where: { ref },
    include: { items: true, history: { orderBy: { createdAt: "asc" } } },
  });
}

export async function getMyOrders() {
  const user = await getCurrentUser();
  if (!user) return [];
  return prisma.order.findMany({
    where: { userId: user.id },
    include: { items: true, history: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}
