"use server";

import { z } from "zod";
import type { OrderItemFit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { shippingFeeFor } from "@/lib/shipping";
import { taxPolicy } from "@/lib/tax";
import { markCartConverted } from "./cart";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { toNumber } from "@/lib/money";
import { computeSegment } from "@/lib/segment";
import { hit, callerKey, LIMITS } from "@/lib/rate-limit";
import { rememberOrder, placedInThisBrowser } from "@/lib/order-access";
import { notifyOrderPlaced } from "@/lib/order-emails";

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

const placeOrderSchema = z.object({
  customerName: shortText.min(2),
  phone: shortText.min(6),
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

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type PlaceOrderResult = { ok: true; ref: string } | { ok: false; error: string };

// Thrown for expected business-rule failures inside the transaction (out of
// stock, deleted product) so we can turn them into a friendly error and roll
// back cleanly — anything else (a real bug, a DB outage) propagates instead
// of being swallowed as if it were the customer's fault.
class OrderError extends Error {}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  // Cash on delivery means a fake order costs the shop a real delivery run, so
  // the ceiling is on volume per address rather than on the customer.
  const gate = hit(await callerKey("checkout"), LIMITS.checkout.limit, LIMITS.checkout.windowMs);
  if (!gate.ok) {
    return {
      ok: false,
      error: `Trop de commandes envoyées coup sur coup. Réessayez dans ${Math.ceil(gate.retryAfter / 60)} minute(s).`,
    };
  }

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
  // Read once, here, and written onto the order below — so the paper the
  // customer files states the rate that was in force when they bought, not
  // whatever the settings say the day somebody prints it again.
  const tax = taxPolicy(settings);
  const user = await getCurrentUser();

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
        if (!product) throw new OrderError("Un produit du panier n'existe plus.");
        // A part the shop cannot source is the only thing that is genuinely
        // refusable here. Everything else at zero is a part the shop orders
        // in — see lib/availability — and refusing that turned a sale the
        // shop wanted into a WhatsApp message it had to chase.
        if (product.stockQty <= 0 && product.supply === "UNAVAILABLE") {
          throw new OrderError(`${product.name} n'est plus approvisionnée.`);
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

    // The basket is no longer abandoned. Outside the transaction on purpose:
    // this is bookkeeping for recovery reporting, and it must never be able to
    // roll back an order that has already claimed stock.
    await markCartConverted(result.id, data.phone);
    // Lets this browser — and only this browser — reopen the confirmation
    // page for a guest order whose reference is otherwise guessable.
    await rememberOrder(result.id);
    // Confirmation to the customer, alert to the shop. Same reasoning as the
    // two lines above and then some: notifyOrderPlaced catches everything and
    // resolves either way, so a mail server having a bad day cannot take down
    // a checkout whose stock is already claimed. Awaited rather than left
    // floating because a promise still in flight when the serverless function
    // returns is a promise that gets killed.
    await notifyOrderPlaced(result.id);

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

/**
 * One order, and only to someone entitled to see it.
 *
 * The ownership test lives here rather than in the page that calls it. This
 * file is "use server", so every export is a callable endpoint in its own
 * right — a check written in the page guards the page, not the function, and
 * the data has already been read out of the database by the time that check
 * runs. Since references are sequential and printed on the confirmation page
 * (CMD-1042, CMD-1043), an unguarded lookup here is a walk through every
 * customer's name, phone number and delivery address, one increment at a time.
 *
 * Entitled means: signed in as the order's owner, or holding the httpOnly
 * cookie the checkout wrote — see lib/order-access. Anything else gets null,
 * which the page turns into a 404, so a guessed reference cannot even be
 * distinguished from one that does not exist.
 */
export async function getOrderByRef(ref: string) {
  const order = await prisma.order.findUnique({
    where: { ref },
    include: { items: true, history: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) return null;

  const user = await getCurrentUser();
  if (user && order.userId === user.id) return order;
  // An admin can already read every order through /admin; letting them through
  // here too is what allows one printable document to serve the customer, the
  // guest who has only the cookie, and the person packing the box.
  if (user?.role === "ADMIN") return order;
  if (await placedInThisBrowser(order.id)) return order;
  return null;
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

/**
 * The guest's way back to their own order.
 *
 * Until now there was none. Checkout does not require an e-mail, the footer's
 * "Suivi de commande" led to a login wall, and the confirmation page is served
 * only to the browser holding the httpOnly cookie that checkout set — so a
 * guest who cleared their cookies, or ordered on a friend's phone, lost the
 * order permanently and the shop inherited the support call.
 *
 * The reference on its own cannot be the key: references are sequential and
 * printed on the page, which is the whole reason `order-access.ts` exists. So
 * the second factor is the phone number on the order — the one detail a
 * customer certainly knows and a guesser would have to walk eight digits to
 * find. Compared on digits alone, because nobody types their own number the
 * same way twice.
 *
 * On success this mints the same proof checkout does: the order id goes into
 * the browser's cookie, so the confirmation page, the printable document and
 * the tracker all work afterwards without a second lookup.
 *
 * One failure message for every kind of failure — unknown reference, wrong
 * phone, malformed input. Saying "that reference exists but the number is
 * wrong" would turn this into an oracle for which references are real.
 */
export async function lookupGuestOrder(
  ref: string,
  phone: string,
): Promise<{ ok: true; ref: string } | { ok: false; error: string }> {
  const gate = hit(await callerKey("orderLookup"), LIMITS.orderLookup.limit, LIMITS.orderLookup.windowMs);
  if (!gate.ok) {
    return {
      ok: false,
      error: `Trop de tentatives. Réessayez dans ${Math.ceil(gate.retryAfter / 60)} minute(s).`,
    };
  }

  const NOT_FOUND = "Aucune commande ne correspond à cette référence et à ce numéro.";
  const cleanRef = ref.trim().toUpperCase().slice(0, 32);
  const digits = phone.replace(/\D/g, "");
  if (cleanRef.length < 3 || digits.length < 6) return { ok: false, error: NOT_FOUND };

  const order = await prisma.order.findUnique({
    where: { ref: cleanRef },
    select: { id: true, ref: true, phone: true },
  });
  if (!order) return { ok: false, error: NOT_FOUND };

  // The stored number may carry spaces, a +216, or neither. Compare the last
  // eight digits so a customer who typed "+216 20 445 566" at checkout and
  // "20445566" here is the same person.
  const stored = order.phone.replace(/\D/g, "");
  const tail = (v: string) => v.slice(-8);
  if (stored.length < 6 || tail(stored) !== tail(digits)) return { ok: false, error: NOT_FOUND };

  await rememberOrder(order.id);
  return { ok: true, ref: order.ref };
}
