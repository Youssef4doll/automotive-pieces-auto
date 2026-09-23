import { NextRequest } from "next/server";
import { z } from "zod";
import { searchForApp } from "@/lib/data/app-catalog";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { Cache, fail, guard, ok, preflight } from "../_lib/respond";

const query = z.string().trim().min(2).max(64);
const id = z.string().trim().min(1).max(64);
const take = z.coerce.number().int().min(1).max(40);

const PUBLIC = { cache: Cache.catalogue, cors: true };
/** A submitted search is not cached: see below. */
const SUBMITTED = { cache: Cache.private, cors: true };

/**
 * Search, for the app — the type-ahead and the results page alike.
 *
 *   q          what the customer typed, 2–64 characters
 *   engine     the garage's engine, for a fitment verdict on every part
 *   take       how many parts, 1–40 (the type-ahead asks for a handful)
 *   submitted  1 when the customer pressed search rather than typed a letter
 *
 * A type-ahead answer is the same for everyone who types the same letters, so
 * it takes the catalogue's shared cache like every other read. A SUBMITTED
 * search does not: a query that finds nothing is written to the shop's demand
 * log, and a cached answer would count the first customer who wanted a part
 * and silently swallow the next forty — which is the number the owner reads
 * to decide what to stock.
 *
 * Rate-limited on the type-ahead's own ceiling, which is generous because it
 * fires on keystrokes (debounced) and many shoppers share one carrier address.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const submitted = params.get("submitted") === "1";
  const policy = submitted ? SUBMITTED : PUBLIC;

  return guard(
    async () => {
      const gate = hit(await callerKey("app-search"), LIMITS.suggest.limit, LIMITS.suggest.windowMs);
      if (!gate.ok) return fail("rate_limited", policy, { "Retry-After": String(gate.retryAfter) });

      const q = query.safeParse(params.get("q") ?? "");
      if (!q.success) return fail("bad_request", policy);

      const engine = params.get("engine");
      const engineId = engine === null ? undefined : id.safeParse(engine);
      if (engineId && !engineId.success) return fail("bad_request", policy);

      const n = params.get("take");
      const count = n === null ? undefined : take.safeParse(n);
      if (count && !count.success) return fail("bad_request", policy);

      const result = await searchForApp(q.data, {
        engineId: engineId?.success ? engineId.data : undefined,
        take: count?.success ? count.data : undefined,
        submitted,
      });
      return ok(result, policy);
    },
    "search",
    policy,
  );
}

export const OPTIONS = preflight;
