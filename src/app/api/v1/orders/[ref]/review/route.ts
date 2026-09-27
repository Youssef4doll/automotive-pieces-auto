import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appOrderView } from "@/lib/orders/view";
import { orderIdForRequest } from "@/lib/orders/request-access";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { fail, guard, ok, preflightWrite, readJson } from "../../../_lib/respond";

const ref = z.string().trim().toUpperCase().min(3).max(32);
const body = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});
const POLICY = { cors: "write" as const };

export const OPTIONS = preflightWrite;

/**
 * The customer rates a delivered order: one to five stars and, if they want,
 * a sentence. Only once the shop has marked it DELIVERED — before that there
 * is nothing to rate yet. Sending again replaces the rating (a customer who
 * tapped two stars by mistake can fix it). For the shop only: shown on the
 * order in the admin, never published.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ ref: string }> }) {
  return guard(
    async () => {
      const gate = hit(await callerKey("order-review"), LIMITS.orderLookup.limit, LIMITS.orderLookup.windowMs);
      if (!gate.ok) return fail("rate_limited", POLICY, { "Retry-After": String(gate.retryAfter) });
      const parsedRef = ref.safeParse((await context.params).ref);
      if (!parsedRef.success) return fail("not_found", POLICY);
      const orderId = await orderIdForRequest(request, parsedRef.data);
      if (orderId === null) return fail("unauthorized", POLICY);
      if (!orderId) return fail("not_found", POLICY);
      const parsed = body.safeParse(await readJson(request, 4_096));
      if (!parsed.success) return fail("invalid_field", POLICY, undefined, { field: String(parsed.error.issues[0]?.path[0] ?? "stars") });

      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
      if (order?.status !== "DELIVERED") return fail("unavailable", POLICY, undefined, { reason: "not_delivered" });

      const data = { stars: parsed.data.stars, comment: parsed.data.comment || null };
      await prisma.orderReview.upsert({ where: { orderId }, create: { orderId, ...data }, update: data });
      return ok(await appOrderView(orderId), POLICY);
    },
    "orders/[ref]/review",
    POLICY,
  );
}
