import bcrypt from "bcryptjs";
import { BCRYPT_COST, deviceLabel, findUserByEmail } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { issueCustomerSession } from "@/lib/customer-session";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { issueReason, signupSchema } from "@/lib/validation";
import { fail, guard, ok, preflightWrite, readJson } from "../../_lib/respond";
import { ACCOUNT_SELECT, accountView, CUSTOMER } from "../../_lib/customer";

export const OPTIONS = preflightWrite;

/**
 * Create an account from the app: `{ name, email, phone, password }` →
 * `{ token, account }`.
 *
 * The rules are the website's (`signupSchema` in lib/validation), so a name
 * the website refuses is refused here, and the refusal names the field. The
 * same budget as the website form: every attempt costs a bcrypt hash.
 *
 * An address that already has an account is `invalid_field` / `email` with
 * `reason: "taken"` — the website says the same thing in words. Hiding it
 * would only send somebody who already has an account round in circles.
 */
export async function POST(request: Request) {
  return guard(
    async () => {
      const gate = hit(await callerKey("signup"), LIMITS.signup.limit, LIMITS.signup.windowMs);
      if (!gate.ok) return fail("rate_limited", CUSTOMER, { "Retry-After": String(gate.retryAfter) });

      const body = await readJson(request, 4_096);
      if (body === undefined) return fail("bad_request", CUSTOMER);
      const parsed = signupSchema.safeParse(body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = String(issue?.path[0] ?? "form");
        const reason = issueReason(issue);
        return fail("invalid_field", CUSTOMER, undefined, { field, ...(reason ? { reason } : {}) });
      }
      const { name, email, phone, password } = parsed.data;

      const existing = await findUserByEmail(email, { id: true });
      if (existing) return fail("invalid_field", CUSTOMER, undefined, { field: "email", reason: "taken" });

      const user = await prisma.user.create({
        data: { name, email, phone, passwordHash: await bcrypt.hash(password, BCRYPT_COST), role: "CUSTOMER" },
        select: ACCOUNT_SELECT,
      });
      const token = await issueCustomerSession(user.id, deviceLabel((body as { device?: unknown }).device));
      return ok({ token, account: accountView(user) }, CUSTOMER);
    },
    "auth signup",
    CUSTOMER,
  );
}
