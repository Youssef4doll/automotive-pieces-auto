"use server";

import { prisma } from "@/lib/prisma";
import { markCartConverted } from "./cart";
import { getCurrentUser } from "@/lib/session";
import { hit, callerKey, LIMITS } from "@/lib/rate-limit";
import { rememberOrder, placedInThisBrowser, ordersFromThisBrowser } from "@/lib/order-access";
import { notifyOrderPlaced } from "@/lib/order-emails";
import { createOrder, placeOrderSchema, type PlaceOrderData } from "@/lib/orders/place";
import { matchGuestOrder } from "@/lib/orders/lookup";
import { claimOrderIds } from "@/lib/orders/claim";

export type PlaceOrderInput = PlaceOrderData;
export type PlaceOrderResult = { ok: true; ref: string } | { ok: false; error: string };

/**
 * The website's checkout.
 *
 * The order itself — prices read fresh, stock claimed atomically, the
 * reference numbered — is `createOrder` in lib/orders/place, shared with the
 * phone app's API. What is here is what only a browser has: the session, the
 * abandoned-basket row keyed to this browser, and the httpOnly cookie that
 * lets it reopen the confirmation page.
 */
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

  const user = await getCurrentUser();
  const result = await createOrder(data, { userId: user?.id });
  if (!result.ok) return { ok: false, error: result.message };

  // The basket is no longer abandoned. Outside the transaction on purpose:
  // this is bookkeeping for recovery reporting, and it must never be able to
  // roll back an order that has already claimed stock.
  await markCartConverted(result.id, data.phone);
  // Lets this browser — and only this browser — reopen the confirmation
  // page for a guest order whose reference is otherwise guessable.
  await rememberOrder(result.id);
  // Confirmation to the customer, alert to the shop. notifyOrderPlaced
  // catches everything and resolves either way, so a mail server having a bad
  // day cannot take down a checkout whose stock is already claimed. Awaited
  // rather than left floating because a promise still in flight when the
  // serverless function returns is a promise that gets killed.
  await notifyOrderPlaced(result.id);

  return { ok: true, ref: result.ref };
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

  const order = await matchGuestOrder(ref, phone);
  if (!order) return { ok: false, error: "Aucune commande ne correspond à cette référence et à ce numéro." };

  await rememberOrder(order.id);
  // Signed in and looking up an order this account does not own yet — they
  // just proved it is theirs with the phone on it, so it joins the account
  // rather than staying a guest order they have to look up again next time.
  const viewer = await getCurrentUser();
  if (viewer && !order.userId) await claimOrdersForUser(viewer.id);
  return { ok: true, ref: order.ref };
}

/**
 * Attach the orders this browser placed as a guest to an account.
 *
 * Checkout does not require an account, so ordering first and registering
 * afterwards is an ordinary thing to do — and the order stayed a guest order
 * for ever. "Mes commandes" was empty for a customer who had just bought
 * something, which reads as the order having been lost.
 *
 * **What counts as proof is the browser's order cookie, not the e-mail.**
 * Nothing on an order is verified — checkout asks and believes the answer — so
 * matching on the address typed at signup would give a stranger's name, phone
 * and delivery address to anyone who registers with that address. The cookie
 * already opens exactly these orders (see lib/order-access), so this hands the
 * account nothing it was not already holding.
 *
 * `userId: null` in the filter matters: an order that already belongs to
 * somebody is never reassigned, whatever cookie the caller is carrying.
 *
 * The customer segment is derived from order history, so it is recomputed
 * here — otherwise a customer who claimed four orders would sit at NEW.
 */
export async function claimOrdersForUser(userId: string) {
  return claimOrderIds(userId, await ordersFromThisBrowser());
}
