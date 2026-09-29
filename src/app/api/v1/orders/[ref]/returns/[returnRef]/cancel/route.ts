import { NextRequest } from "next/server";
import { z } from "zod";
import { appOrderView } from "@/lib/orders/view";
import { orderIdForRequest } from "@/lib/orders/request-access";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { cancelReturn } from "@/lib/returns";
import { fail, guard, ok, preflightWrite } from "../../../../../_lib/respond";

const ref = z.string().trim().toUpperCase().min(3).max(32);
const POLICY = { cors: "write" as const };

export const OPTIONS = preflightWrite;

/**
 * The customer withdraws a return request — only while the shop has not
 * answered it. Answers the order, or `unavailable` with `reason: "answered"`.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ ref: string; returnRef: string }> }) {
  return guard(
    async () => {
      const gate = hit(await callerKey("return-cancel"), LIMITS.orderLookup.limit, LIMITS.orderLookup.windowMs);
      if (!gate.ok) return fail("rate_limited", POLICY, { "Retry-After": String(gate.retryAfter) });
      const params = await context.params;
      const orderRef = ref.safeParse(params.ref);
      const returnRef = ref.safeParse(params.returnRef);
      if (!orderRef.success || !returnRef.success) return fail("not_found", POLICY);
      const orderId = await orderIdForRequest(request, orderRef.data);
      if (orderId === null) return fail("unauthorized", POLICY);
      if (!orderId) return fail("not_found", POLICY);
      if (!(await cancelReturn(orderId, returnRef.data))) return fail("unavailable", POLICY, undefined, { reason: "answered" });
      return ok(await appOrderView(orderId), POLICY);
    },
    "orders/[ref]/returns/[returnRef]/cancel",
    POLICY,
  );
}
