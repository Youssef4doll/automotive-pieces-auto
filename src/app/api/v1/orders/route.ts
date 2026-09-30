import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueOrderToken } from "@/lib/order-token";
import { notifyOrderPlaced } from "@/lib/order-emails";
import { createOrder, placeOrderSchema } from "@/lib/orders/place";
import { appOrderView } from "@/lib/orders/view";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { customerForRequest } from "@/lib/customer-session";
import { fail, guard, ok, preflightWrite, readJson } from "../_lib/respond";

/** Never cached, never shared. Write CORS: this route reads no cookie — see respond.ts. */
const POLICY = { cors: "write" as const };

/**
 * `Idempotency-Key`: the app's answer to "did my order go through?".
 *
 * A checkout on a weak signal can time out after the shop has placed the
 * order — and the customer, seeing an error, taps again. Without a key that
 * is a second parcel on the van. With one, the second POST finds the order the
 * first one made and answers with it: the same reference, a fresh token for
 * the phone (the first answer's token never arrived), no second e-mail.
 *
 * The app makes a new key whenever what it sends changes, so a key names one
 * basket, one address, one attempt. 16–64 URL-safe characters, random; kept
 * as a SHA-256 only, because a key and its order are enough to mint a token.
 * A replay is honoured for a day — long enough for any retry, short enough
 * that a key found later opens nothing.
 */
const KEY_SHAPE = /^[A-Za-z0-9_-]{16,64}$/;
const REPLAY_WINDOW_MS = 24 * 60 * 60 * 1000;

async function replay(keyHash: string) {
  const order = await prisma.order.findUnique({ where: { idempotencyKeyHash: keyHash }, select: { id: true, ref: true, createdAt: true } });
  if (!order) return null;
  if (Date.now() - order.createdAt.getTime() > REPLAY_WINDOW_MS) {
    return fail("invalid_field", POLICY, undefined, { field: "idempotencyKey", reason: "used" });
  }
  const token = await issueOrderToken(order.id);
  return ok({ ref: order.ref, token, order: await appOrderView(order.id), replayed: true }, POLICY);
}

/**
 * Place a cash-on-delivery order from the phone app.
 *
 * The order is made by `createOrder`, the same function behind the website's
 * checkout: prices read fresh inside the transaction, stock claimed
 * atomically, the reference numbered from the highest existing one. The body
 * carries product ids and quantities and never a price.
 *
 * The answer is the reference, the order as the app may show it, and a
 * token — the only proof the phone will ever hold that the order is its own.
 * It is returned once, here, and stored only as a hash; lose it and the
 * order is recovered with its reference and phone number, like a guest on
 * the website.
 *
 * Validation failures name the field (`invalid_field` + `field`) rather than
 * returning the website's French sentence, because the app writes its own
 * three languages. The rules are the website's rules — `placeOrderSchema`
 * wraps lib/validation — so a name the website refuses is refused here too.
 */
export async function POST(request: NextRequest) {
  return guard(
    async () => {
      // A fake cash-on-delivery order costs the shop a real delivery run.
      const gate = hit(await callerKey("checkout"), LIMITS.checkout.limit, LIMITS.checkout.windowMs);
      if (!gate.ok) return fail("rate_limited", POLICY, { "Retry-After": String(gate.retryAfter) });

      const key = request.headers.get("idempotency-key");
      if (key !== null && !KEY_SHAPE.test(key)) return fail("invalid_field", POLICY, undefined, { field: "idempotencyKey" });
      const keyHash = key ? createHash("sha256").update(key, "utf8").digest("hex") : undefined;
      if (keyHash) {
        const earlier = await replay(keyHash);
        if (earlier) return earlier;
      }

      const body = await readJson(request);
      if (body === undefined) return fail("bad_request", POLICY);

      const parsed = placeOrderSchema.safeParse(body);
      if (!parsed.success) {
        const field = String(parsed.error.issues[0]?.path[0] ?? "form");
        return fail("invalid_field", POLICY, undefined, { field });
      }
      // The only way to pay. The app never offers anything else, so a CARD
      // here is a client bug, and it is reported as the field it is.
      if (parsed.data.paymentMethod !== "COD") {
        return fail("invalid_field", POLICY, undefined, { field: "paymentMethod" });
      }
      // A delivery needs somewhere to deliver to. The website's form enforces
      // this in the browser; an API has no form, so it is enforced here.
      if (parsed.data.deliveryMethod === "DELIVERY" && (parsed.data.address ?? "").trim().length < 5) {
        return fail("invalid_field", POLICY, undefined, { field: "address" });
      }

      // Signed in on the app: the order joins the account. A token that has
      // lapsed places a guest order rather than refusing the parcel — the
      // order token still makes it the phone's own.
      const customer = await customerForRequest(request);
      const result = await createOrder(parsed.data, { issueToken: true, userId: customer?.id, idempotencyKeyHash: keyHash });
      if (!result.ok && result.code === "duplicate") {
        // Two taps raced and the other one committed first: its order is this one.
        const earlier = keyHash ? await replay(keyHash) : null;
        return earlier ?? fail("server_error", POLICY);
      }
      if (!result.ok) {
        // The code stopped applying since the basket was priced: the field
        // the customer has to change, and why.
        if (result.code === "promo") {
          return fail("invalid_field", POLICY, undefined, {
            field: "promoCode",
            reason: result.reason,
            ...(result.minSubtotal != null ? { minSubtotal: String(result.minSubtotal) } : {}),
          });
        }
        return fail("unavailable", POLICY, undefined, { productId: result.productId, reason: result.code });
      }

      // Confirmation to the customer when they gave an e-mail, alert to the
      // shop. Catches everything; awaited so a serverless return cannot kill
      // it mid-flight.
      await notifyOrderPlaced(result.id);

      const order = await appOrderView(result.id);
      return ok({ ref: result.ref, token: result.token, order }, POLICY);
    },
    "orders",
    POLICY,
  );
}

export const OPTIONS = preflightWrite;
