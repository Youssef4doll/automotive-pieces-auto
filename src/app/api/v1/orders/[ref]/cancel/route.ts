import { NextRequest } from "next/server";
import { z } from "zod";
import { bearerToken, orderIdForToken } from "@/lib/order-token";
import { customerForRequest } from "@/lib/customer-session";
import { prisma } from "@/lib/prisma";
import { appOrderView } from "@/lib/orders/view";
import { setOrderStatus } from "@/lib/admin/orders";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { fail, guard, ok, preflightWrite } from "../../../_lib/respond";

const ref = z.string().trim().toUpperCase().min(3).max(32);
const POLICY = { cors: "write" as const };

export const OPTIONS = preflightWrite;

/**
 * The customer cancels their own order — only while it is still PENDING,
 * before the shop has confirmed it and started to prepare it. After that it
 * is a conversation with the shop (the app offers call and WhatsApp).
 *
 * Same key as reading the order: its own token, or the session of the
 * account it belongs to. The status moves through setOrderStatus, the one
 * path the admin uses too, so the history row and the customer's e-mail are
 * the same whoever cancelled. Answers the updated order, or `unavailable`
 * with `reason: "not_pending"`.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ ref: string }> }) {
  return guard(
    async () => {
      const gate = hit(await callerKey("app-order-cancel"), LIMITS.orderLookup.limit, LIMITS.orderLookup.windowMs);
      if (!gate.ok) return fail("rate_limited", POLICY, { "Retry-After": String(gate.retryAfter) });

      const token = bearerToken(request.headers.get("authorization"));
      if (!token) return fail("unauthorized", POLICY);
      const parsed = ref.safeParse((await context.params).ref);
      if (!parsed.success) return fail("not_found", POLICY);

      let orderId = await orderIdForToken(parsed.data, token);
      if (!orderId) {
        const customer = await customerForRequest(request);
        if (customer) {
          const owned = await prisma.order.findFirst({ where: { ref: parsed.data, userId: customer.id }, select: { id: true } });
          orderId = owned?.id ?? null;
        }
      }
      if (!orderId) return fail("not_found", POLICY);

      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
      if (order?.status !== "PENDING") return fail("unavailable", POLICY, undefined, { reason: "not_pending" });

      await setOrderStatus(orderId, "CANCELLED", { push: false, by: "customer" });
      return ok(await appOrderView(orderId), POLICY);
    },
    "orders/[ref]/cancel",
    POLICY,
  );
}
