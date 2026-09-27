import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { EXPO_TOKEN } from "@/lib/push-copy";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { fail, guard, ok, preflightWrite, readJson } from "../../../_lib/respond";

const slug = z.string().trim().min(1).max(200);
const body = z.object({
  token: z.string().regex(EXPO_TOKEN),
  locale: z.enum(["fr", "en", "ar"]).default("fr"),
});
const POLICY = { cors: "write" as const };

export const OPTIONS = preflightWrite;

/**
 * "Prévenez-moi quand elle revient" — one push, the first time this part is
 * back on the shelf (lib/push notifyBackInStock). Only for a part that is
 * not on the shelf now: asking about one that is would be answered by a
 * notification nobody needs. DELETE withdraws the request.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return guard(
    async () => {
      const gate = hit(await callerKey("push-register"), LIMITS.pushRegister.limit, LIMITS.pushRegister.windowMs);
      if (!gate.ok) return fail("rate_limited", POLICY, { "Retry-After": String(gate.retryAfter) });
      const s = slug.safeParse((await context.params).slug);
      if (!s.success) return fail("not_found", POLICY);
      const product = await prisma.product.findFirst({ where: { slug: s.data, active: true }, select: { id: true, stockQty: true } });
      if (!product) return fail("not_found", POLICY);
      const parsed = body.safeParse(await readJson(request, 1_024));
      if (!parsed.success) return fail("invalid_field", POLICY, undefined, { field: "token" });
      if (product.stockQty > 0) return fail("unavailable", POLICY, undefined, { reason: "in_stock" });

      await prisma.stockAlert.upsert({
        where: { productId_token: { productId: product.id, token: parsed.data.token } },
        create: { productId: product.id, token: parsed.data.token, locale: parsed.data.locale },
        update: { locale: parsed.data.locale, notifiedAt: null },
      });
      return ok({ subscribed: true }, POLICY);
    },
    "products/[slug]/stock-alert",
    POLICY,
  );
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return guard(
    async () => {
      const s = slug.safeParse((await context.params).slug);
      if (!s.success) return fail("not_found", POLICY);
      const parsed = body.safeParse(await readJson(request, 1_024));
      if (!parsed.success) return fail("invalid_field", POLICY, undefined, { field: "token" });
      await prisma.stockAlert.deleteMany({ where: { product: { slug: s.data }, token: parsed.data.token } });
      return ok({ subscribed: false }, POLICY);
    },
    "products/[slug]/stock-alert",
    POLICY,
  );
}
