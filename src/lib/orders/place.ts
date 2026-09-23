import "server-only";
import { z } from "zod";
import type { OrderItemFit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { shippingFeeFor } from "@/lib/shipping";
import { taxPolicy } from "@/lib/tax";
import { getSettings } from "@/lib/settings";
import { toNumber } from "@/lib/money";
import { computeSegment } from "@/lib/segment";
import { issueOrderToken } from "@/lib/order-token";
import { personName, phoneNumber } from "@/lib/validation";

/**
 * Placing an order — the part both front doors share.
 *
 * This was the body of the `placeOrder` server action. It moved here when the
 * phone app gained a checkout, because the app cannot call a server action
 * and the alternative was a second copy of the one function in this codebase
 * that must never have two: it reads prices, claims stock, writes the order
 * and its history, and numbers it. Two copies of that would drift the first
 * time somebody fixed a bug in one of them.
 *
 * What stays with each caller is what differs between them:
 *
 *   the website's action reads the session, marks the browser's abandoned
 *   basket converted and drops the order id into the httpOnly cookie that
 *   lets that browser reopen the confirmation page;
 *
 *   the app API has no session and no cookie at all, and asks for an access
 *   token instead — minted inside the same transaction as the order.
 *
 * Rate limiting stays with the callers too, because they identify the caller
 * differently.
 */

const itemSchema = z.object({
  // Prisma ids are cuids; bounding the string keeps a megabyte of junk out of
  // the `IN (...)` clause.
  productId: z.string().min(1).max(64),
  // The atomic stock claim below is what actually prevents overselling, but a
  // bounded quantity keeps an absurd order from being built in the first place.
  qty: z.number().int().positive().max(999),
});

/** Free-text fields a customer types. Bounded so a form post cannot be a payload. */
const shortText = z.string().trim().max(200);
const longText = z.string().trim().max(2000);

export const placeOrderSchema = z.object({
  // The same rules the signup form uses — see lib/validation. This name is
  // read off a delivery note by a driver at somebody's door, so `min(2)` was
  // not enough: it accepted `ttttt@gmail.com`.
  customerName: personName,
  phone: phoneNumber,
  email: z.email().max(200).optional().or(z.literal("")),
  governorate: shortText.min(2),
  address: longText.optional(),
  deliveryMethod: z.enum(["DELIVERY", "PICKUP"]),
  paymentMethod: z.enum(["COD", "CARD"]),
  notes: longText.optional(),
  // An order with hundreds of distinct lines is a script, not a shopper.
  items: z.array(itemSchema).min(1).max(50),
  // First-touch marketing attribution, read client-side from localStorage
  // at submit time — see lib/attribution.ts. Never trusted for anything
  // but reporting (it doesn't affect price, stock, or order validity), so
  // it's fine that a client could send anything here — bounded all the same,
  // because "only used for reporting" still means "written to the database".
  source: shortText.optional(),
  medium: shortText.optional(),
  campaign: shortText.optional(),
  // The engine the shopper had selected. An id only — the label and the
  // compatibility verdict are both read out of our own tables below, because
  // a client-supplied "Renault Clio 1.5 dCi" is a string a client made up,
  // and this one goes on a delivery note.
  vehicleEngineId: z.string().min(1).max(64).optional(),
});

export type PlaceOrderData = z.infer<typeof placeOrderSchema>;

/**
 * An expected refusal: a part withdrawn or no longer sourceable.
 *
 * Thrown inside the transaction so it rolls back cleanly and caught below.
 * Anything else — a real bug, a database outage — propagates instead of
 * being reported as if it were the customer's fault. The French message is
 * the website's; the code and product id are for the app, which writes its
 * own three languages.
 */
class OrderError extends Error {
  constructor(
    readonly code: "gone" | "unsourceable",
    readonly productId: string,
    message: string,
  ) {
    super(message);
  }
}

export type CreateOrderResult =
  | { ok: true; id: string; ref: string; token: string | null }
  | { ok: false; code: "gone" | "unsourceable"; productId: string; message: string };

export async function createOrder(
  data: PlaceOrderData,
  ctx: { userId?: string; issueToken?: boolean } = {},
): Promise<CreateOrderResult> {
  const settings = await getSettings();
  const freeShippingThreshold = Number(settings.free_shipping_threshold) || 150;
  // Read once, here, and written onto the order below — so the paper the
  // customer files states the rate that was in force when they bought, not
  // whatever the settings say the day somebody prints it again.
  const tax = taxPolicy(settings);

  // The car, and what we already know about the parts on it.
  //
  // This is the whole point of asking: an order that names the vehicle can be
  // checked against the fitment table before anyone picks it off a shelf, so
  // the shop either confirms it without ringing the customer or catches a
  // wrong part before it is driven across Tunis and driven back. Both reads
  // are plain lookups and are done here rather than inside the transaction,
  // which is holding stock rows and should stay short.
  const engine = data.vehicleEngineId
    ? await prisma.vehicleEngine.findUnique({
        where: { id: data.vehicleEngineId },
        select: { id: true, name: true, model: { select: { name: true, make: { select: { name: true } } } } },
      })
    : null;
  const vehicleLabel = engine
    ? `${engine.model.make.name} ${engine.model.name} ${engine.name}`
    : null;
  // Only rows for this engine, keyed by product. A part with no row here is
  // one we hold no compatibility for — which is a different thing from a part
  // we know does not fit, and is recorded as UNLISTED rather than guessed at.
  const fitByProduct = new Map<string, OrderItemFit>();
  if (engine) {
    const rows = await prisma.productFitment.findMany({
      where: { engineId: engine.id, productId: { in: data.items.map((i) => i.productId) } },
      select: { productId: true, confidence: true },
    });
    for (const r of rows) fitByProduct.set(r.productId, r.confidence);
  }

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
      // `active: true` matters as much as the price does. Deactivating a part
      // in the admin is how the shop withdraws it from sale; without this
      // filter a stale tab — or a posted id — could still buy it, and the
      // order would look perfectly legitimate afterwards.
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, active: true },
        include: { images: { orderBy: { order: "asc" }, take: 1, select: { id: true } } },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      const lineItems = data.items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) throw new OrderError("gone", item.productId, "Un produit du panier n'existe plus.");
        // A part the shop cannot source is the only thing that is genuinely
        // refusable here. Everything else at zero is a part the shop orders
        // in — see lib/availability — and refusing that turned a sale the
        // shop wanted into a WhatsApp message it had to chase.
        if (product.stockQty <= 0 && product.supply === "UNAVAILABLE") {
          throw new OrderError("unsourceable", product.id, `${product.name} n'est plus approvisionnée.`);
        }
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
          // Null when no car was given: "we were not told" and "we hold no
          // row for it" are different facts, and the shop acts on them
          // differently.
          fit: engine ? (fitByProduct.get(product.id) ?? "UNLISTED") : null,
          // Recorded per line, because one basket can mix what is on the
          // shelf with what has to be fetched, and the picking bench needs
          // to know which is which before it starts.
          backorder: product.stockQty < item.qty,
        };
      });

      // Claim stock atomically per item: the `stockQty: { gte: item.qty }`
      // guard means the decrement only applies if enough stock is *still*
      // there at the moment of the write. Checking stockQty earlier and
      // decrementing later (the previous version of this code) left a gap
      // where two concurrent checkouts for the last unit could both pass
      // the check and both decrement — overselling and driving stock
      // negative. `updateMany`'s matched count tells us which case we're in.
      //
      // Failing that claim is no longer an error. It used to be: a part with
      // nothing on the shelf could not be bought at all, which is wrong for a
      // shop that orders most of its catalogue in. So the claim is still
      // attempted — it is what keeps two concurrent buyers of the last unit
      // from both getting it — and when it does not match, the line is simply
      // one the shop has to fetch. Stock never goes negative either way.
      for (const item of data.items) {
        const { count } = await tx.product.updateMany({
          where: { id: item.productId, stockQty: { gte: item.qty } },
          data: { stockQty: { decrement: item.qty } },
        });
        if (count === 0) {
          const line = lineItems.find((l) => l.productId === item.productId);
          if (line) line.backorder = true;
        }
      }

      const subtotal = lineItems.reduce((s, l) => s + l.lineTotal, 0);
      const shippingFee = shippingFeeFor(subtotal, freeShippingThreshold, data.deliveryMethod);
      // Prices are TTC, so the rate adds nothing here — it only decides how
      // the total is broken out on the document. The droit de timbre is a
      // real extra dinar, and it is quoted in the cart and on the checkout
      // summary before this runs, so it is never a surprise at this point.
      const total = subtotal + shippingFee + tax.stampDuty;

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
          userId: ctx.userId,
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
          vehicleEngineId: engine?.id,
          vehicleLabel,
          subtotal,
          shippingFee,
          vatRate: tax.vatRate,
          stampDuty: tax.stampDuty,
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
      if (ctx.userId) {
        const priorOrders = await tx.order.findMany({
          where: { userId: ctx.userId, status: { not: "CANCELLED" } },
          select: { total: true },
        });
        const completedCount = priorOrders.length + 1; // + the order just created
        const totalSpent = priorOrders.reduce((s, o) => s + toNumber(o.total), 0) + total;
        await tx.user.update({
          where: { id: ctx.userId },
          data: { segment: computeSegment(completedCount, totalSpent) },
        });
      }

      // Minted inside the transaction, so an order and the only key the app
      // will ever hold to it exist together or not at all. A token written
      // after commit could fail and leave the customer with an order their
      // phone cannot open.
      const token = ctx.issueToken ? await issueOrderToken(order.id, tx) : null;

      return { id: order.id, ref: order.ref, token };
    });

    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof OrderError) {
      return { ok: false, code: e.code, productId: e.productId, message: e.message };
    }
    const isRefCollision =
      typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
    if (isRefCollision && attempt < MAX_REF_ATTEMPTS) continue;
    throw e;
  }
  }
}
