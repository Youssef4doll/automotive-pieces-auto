import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setPassword } from "@/lib/accounts";
import { callerKey, clear, hit, LIMITS } from "@/lib/rate-limit";
import { checkPersonalPassword, issueReason, passwordRule } from "@/lib/validation";
import { fail, ok, preflightWrite, readJson } from "../../_lib/respond";
import { asCustomer, CUSTOMER } from "../../_lib/customer";

export const OPTIONS = preflightWrite;

/**
 * Change the password from the app: `{ current, next }` → `{ signedOut: n }`.
 *
 * The current password is asked for, as on the website: a phone left
 * unlocked must not be enough to lock its owner out. That makes this a
 * password-guessing surface, so it spends the login budget, per account.
 *
 * The new password meets the signup rule (lib/validation) and may not be the
 * old one. Then every other session is signed out — the other phones, the
 * staff sessions, every website cookie (lib/accounts, setPassword) — and
 * this phone stays signed in. `signedOut` is how many other phones that was,
 * so the app can say so.
 *
 * Refusals name the field: `current` / `wrong`, or `next` with the rule's
 * reason (`short`, `long`, `common`, `personal`, `same`).
 */
const body = z.object({ current: z.string().min(1).max(200), next: z.string().max(200) });

export async function POST(request: Request) {
  return asCustomer(request, "password POST", async (customer) => {
    const key = await callerKey(`pwchange:${customer.id}`);
    const gate = hit(key, LIMITS.loginPerAccount.limit, LIMITS.loginPerAccount.windowMs);
    if (!gate.ok) return fail("rate_limited", CUSTOMER, { "Retry-After": String(gate.retryAfter) });

    const parsed = body.safeParse(await readJson(request, 2_048));
    if (!parsed.success) return fail("invalid_field", CUSTOMER, undefined, { field: String(parsed.error.issues[0]?.path[0] ?? "form") });
    const { current, next } = parsed.data;

    const rule = passwordRule
      .superRefine((v, ctx) => checkPersonalPassword(v, { email: customer.email, name: customer.name }, ctx, "next"))
      .safeParse(next);
    if (!rule.success) {
      const reason = issueReason(rule.error.issues[0]);
      return fail("invalid_field", CUSTOMER, undefined, { field: "next", ...(reason ? { reason } : {}) });
    }
    if (next === current) return fail("invalid_field", CUSTOMER, undefined, { field: "next", reason: "same" });

    const row = await prisma.user.findUnique({ where: { id: customer.id }, select: { passwordHash: true } });
    if (!row || !(await bcrypt.compare(current, row.passwordHash))) {
      return fail("invalid_field", CUSTOMER, undefined, { field: "current", reason: "wrong" });
    }
    clear(key);

    const others = await prisma.customerSession.count({ where: { userId: customer.id, id: { not: customer.sessionId } } });
    await setPassword(customer.id, next, { keepAppSession: customer.sessionId });
    return ok({ signedOut: others }, CUSTOMER);
  });
}
