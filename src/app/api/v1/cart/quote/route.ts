import { NextRequest } from "next/server";
import { z } from "zod";
import { quoteAppCart } from "@/lib/data/app-catalog";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { Cache, fail, guard, ok, preflightWrite, readJson } from "../../_lib/respond";

/** The same bounds checkout puts on a basket, so a quote cannot promise what an order would refuse. */
const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        qty: z.number().int().positive().max(999),
      }),
    )
    .max(50),
  engineId: z.string().min(1).max(64).optional(),
  deliveryMethod: z.enum(["DELIVERY", "PICKUP"]).optional(),
});

/** Priced per caller, never shared: the body is the basket. */
const POLICY = { cache: Cache.private, cors: "write" as const };

/**
 * Price a basket the way checkout will.
 *
 * POST rather than GET because a basket of fifty lines does not fit in a URL
 * that every proxy between Tunis and Vercel will pass unmangled. It changes
 * nothing — no stock is claimed, nothing is written — and it reads no cookie,
 * which is what lets it take the write CORS profile; see respond.ts.
 *
 * The app sends ids and quantities. It never sends a price, and there is
 * nowhere in this body to put one.
 */
export async function POST(request: NextRequest) {
  return guard(
    async () => {
      // A basket screen re-prices on every quantity tap, so it shares the
      // type-ahead's generous ceiling rather than checkout's.
      const gate = hit(await callerKey("app-quote"), LIMITS.suggest.limit, LIMITS.suggest.windowMs);
      if (!gate.ok) return fail("rate_limited", POLICY, { "Retry-After": String(gate.retryAfter) });

      const parsed = schema.safeParse(await readJson(request));
      if (!parsed.success) return fail("bad_request", POLICY);

      return ok(await quoteAppCart(parsed.data), POLICY);
    },
    "cart/quote",
    POLICY,
  );
}

export const OPTIONS = preflightWrite;
