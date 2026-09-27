import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { orderIdForRequest } from "@/lib/orders/request-access";
import { EXPO_TOKEN } from "@/lib/push-copy";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { fail, guard, ok, preflightWrite, readJson } from "../../../_lib/respond";

const ref = z.string().trim().toUpperCase().min(3).max(32);
const body = z.object({
  token: z.string().regex(EXPO_TOKEN),
  locale: z.enum(["fr", "en", "ar"]).default("fr"),
});
const POLICY = { cors: "write" as const };

export const OPTIONS = preflightWrite;

/**
 * "Tell this phone when the order moves." The phone proves it may read the
 * order (its order token, or the account's session) and hands over its Expo
 * push token; setOrderStatus then pushes each change to it (lib/push).
 * Registering twice is the same as once. DELETE stops it.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ ref: string }> }) {
  return guard(
    async () => {
      const gate = hit(await callerKey("push-register"), LIMITS.pushRegister.limit, LIMITS.pushRegister.windowMs);
      if (!gate.ok) return fail("rate_limited", POLICY, { "Retry-After": String(gate.retryAfter) });
      const parsedRef = ref.safeParse((await context.params).ref);
      if (!parsedRef.success) return fail("not_found", POLICY);
      const orderId = await orderIdForRequest(request, parsedRef.data);
      if (orderId === null) return fail("unauthorized", POLICY);
      if (!orderId) return fail("not_found", POLICY);
      const parsed = body.safeParse(await readJson(request, 1_024));
      if (!parsed.success) return fail("invalid_field", POLICY, undefined, { field: "token" });

      await prisma.orderPushToken.upsert({
        where: { orderId_token: { orderId, token: parsed.data.token } },
        create: { orderId, token: parsed.data.token, locale: parsed.data.locale },
        update: { locale: parsed.data.locale },
      });
      return ok({ subscribed: true }, POLICY);
    },
    "orders/[ref]/push",
    POLICY,
  );
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ ref: string }> }) {
  return guard(
    async () => {
      const parsedRef = ref.safeParse((await context.params).ref);
      if (!parsedRef.success) return fail("not_found", POLICY);
      const orderId = await orderIdForRequest(request, parsedRef.data);
      if (orderId === null) return fail("unauthorized", POLICY);
      if (!orderId) return fail("not_found", POLICY);
      const parsed = body.safeParse(await readJson(request, 1_024));
      if (!parsed.success) return fail("invalid_field", POLICY, undefined, { field: "token" });
      await prisma.orderPushToken.deleteMany({ where: { orderId, token: parsed.data.token } });
      return ok({ subscribed: false }, POLICY);
    },
    "orders/[ref]/push",
    POLICY,
  );
}
