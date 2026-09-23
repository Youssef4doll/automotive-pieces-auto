import { NextRequest } from "next/server";
import { z } from "zod";
import { bearerToken, orderIdForToken } from "@/lib/order-token";
import { appOrderView } from "@/lib/orders/view";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { fail, guard, ok, preflightWrite } from "../../_lib/respond";

const ref = z.string().trim().toUpperCase().min(3).max(32);

/** Private, uncached. Write CORS because it takes `Authorization`; no cookie is read. */
const POLICY = { cors: "write" as const };

/**
 * One order, to the phone holding its token.
 *
 * `Authorization: Bearer <token>` and nothing else — no session, no cookie,
 * no e-mail match. An e-mail on an order is whatever was typed at checkout,
 * unverified, and accepting it as proof would hand a stranger's name, phone
 * and address to anyone who typed it.
 *
 * A missing header is 401; a token that does not open this reference is 404,
 * the same answer as a reference that does not exist, so the endpoint cannot
 * be used to learn which references are real.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ ref: string }> }) {
  return guard(
    async () => {
      const gate = hit(await callerKey("app-order"), LIMITS.orderRead.limit, LIMITS.orderRead.windowMs);
      if (!gate.ok) return fail("rate_limited", POLICY, { "Retry-After": String(gate.retryAfter) });

      const token = bearerToken(request.headers.get("authorization"));
      if (!token) return fail("unauthorized", POLICY);

      const parsed = ref.safeParse((await context.params).ref);
      if (!parsed.success) return fail("not_found", POLICY);

      const orderId = await orderIdForToken(parsed.data, token);
      if (!orderId) return fail("not_found", POLICY);

      const order = await appOrderView(orderId);
      if (!order) return fail("not_found", POLICY);
      return ok(order, POLICY);
    },
    "orders/[ref]",
    POLICY,
  );
}

export const OPTIONS = preflightWrite;
