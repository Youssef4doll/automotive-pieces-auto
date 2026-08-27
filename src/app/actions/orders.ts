"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { toNumber } from "@/lib/money";

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
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type PlaceOrderResult = { ok: true; ref: string } | { ok: false; error: string };

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

  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  for (const item of data.items) {
    const product = productMap.get(item.productId);
    if (!product) return { ok: false, error: "Un produit du panier n'existe plus." };
    if (product.stockQty < item.qty) {
      return { ok: false, error: `Stock insuffisant pour ${product.name} (${product.stockQty} disponible(s)).` };
    }
  }

  const lineItems = data.items.map((item) => {
    const product = productMap.get(item.productId)!;
    const unitPrice = toNumber(product.priceSell);
    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      imageUrl: product.imageUrl,
      unitPrice,
      qty: item.qty,
      lineTotal: unitPrice * item.qty,
    };
  });

  const subtotal = lineItems.reduce((s, l) => s + l.lineTotal, 0);
  const shippingFee =
    data.deliveryMethod === "PICKUP" ? 0 : subtotal >= freeShippingThreshold ? 0 : 8;
  const total = subtotal + shippingFee;

  const user = await getCurrentUser();

  const result = await prisma.$transaction(async (tx) => {
    const count = await tx.order.count();
    const ref = `CMD-${1000 + count + 1}`;

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
        subtotal,
        shippingFee,
        total,
        notes: data.notes,
        items: { create: lineItems },
        history: { create: { status: "PENDING" } },
      },
    });

    for (const item of data.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { decrement: item.qty } },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          change: -item.qty,
          reason: "order",
          note: `Commande ${ref}`,
        },
      });
    }

    return order;
  });

  return { ok: true, ref: result.ref };
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
