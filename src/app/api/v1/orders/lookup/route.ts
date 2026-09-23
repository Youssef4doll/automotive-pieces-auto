import { NextRequest } from "next/server";
import { z } from "zod";
import { issueOrderToken } from "@/lib/order-token";
import { matchGuestOrder } from "@/lib/orders/lookup";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { fail, guard, ok, preflightWrite, readJson } from "../../_lib/respond";

const schema = z.object({
  ref: z.string().trim().min(3).max(32),
  phone: z.string().trim().min(6).max(40),
});

const POLICY = { cors: "write" as const };

/**
 * Recover an order on a phone that does not hold its token.
 *
 * A new phone, a reinstalled app, an order placed on the website: the
 * customer has the reference from the confirmation and knows their own phone
 * number. `matchGuestOrder` is the website's rule for the same form — the
 * reference plus the last eight digits of the number on the order — and on a
 * match this mints a fresh token for this phone. Tokens already issued to
 * other phones keep working; each phone holds its own.
 *
 * The tightest rate limit in the shop, the website's own `orderLookup`,
 * because references are sequential and the phone number is the only thing
 * between a guesser and a stranger's delivery address. One answer for every
 * failure, so the endpoint cannot tell a guesser which references exist.
 */
export async function POST(request: NextRequest) {
  return guard(
    async () => {
      const gate = hit(await callerKey("orderLookup"), LIMITS.orderLookup.limit, LIMITS.orderLookup.windowMs);
      if (!gate.ok) return fail("rate_limited", POLICY, { "Retry-After": String(gate.retryAfter) });

      const parsed = schema.safeParse(await readJson(request));
      if (!parsed.success) return fail("not_found", POLICY);

      const order = await matchGuestOrder(parsed.data.ref, parsed.data.phone);
      if (!order) return fail("not_found", POLICY);

      const token = await issueOrderToken(order.id);
      return ok({ ref: order.ref, token }, POLICY);
    },
    "orders/lookup",
    POLICY,
  );
}

export const OPTIONS = preflightWrite;
