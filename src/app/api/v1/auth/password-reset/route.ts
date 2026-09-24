import { z } from "zod";
import { startPasswordReset } from "@/lib/password-reset";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { fail, guard, ok, preflightWrite, readJson } from "../../_lib/respond";
import { CUSTOMER } from "../../_lib/customer";

export const OPTIONS = preflightWrite;

/**
 * "Mot de passe oublié" from the app: `{ email }` → `{ sent: true }`.
 *
 * The link in the e-mail opens the website's reset page, which is where the
 * new password is chosen — one reset flow, not two. The answer is identical
 * whether or not the address has an account, so this cannot be used to list
 * who shops here. Rate-limited on the website's budget: each request is an
 * e-mail sent from the shop's address.
 */
export async function POST(request: Request) {
  return guard(
    async () => {
      const gate = hit(await callerKey("pwreset"), LIMITS.passwordReset.limit, LIMITS.passwordReset.windowMs);
      if (!gate.ok) return fail("rate_limited", CUSTOMER, { "Retry-After": String(gate.retryAfter) });

      const parsed = z.object({ email: z.email().max(200) }).safeParse(await readJson(request, 2_048));
      if (!parsed.success) return fail("invalid_field", CUSTOMER, undefined, { field: "email" });

      await startPasswordReset(parsed.data.email);
      return ok({ sent: true }, CUSTOMER);
    },
    "auth password-reset",
    CUSTOMER,
  );
}
