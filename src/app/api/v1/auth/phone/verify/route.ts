import { z } from "zod";
import { deviceLabel } from "@/lib/accounts";
import { issueCustomerSession } from "@/lib/customer-session";
import { checkCode, e164, issueTicket } from "@/lib/phone-code";
import { prisma } from "@/lib/prisma";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { fail, guard, ok, preflightWrite, readJson } from "../../../_lib/respond";
import { ACCOUNT_SELECT, accountView, CUSTOMER } from "../../../_lib/customer";

export const OPTIONS = preflightWrite;

const body = z.object({
  phone: z.string().trim().max(30),
  code: z.string().trim().max(12),
  device: z.string().max(200).optional(),
});

/**
 * The code, typed back: `{ phone, code, device? }` →
 *
 *   `{ token, account }`        the number belongs to an account: signed in;
 *   `{ ticket, needsAccount }`  it belongs to none yet: a fifteen-minute,
 *                               one-use proof to open one (auth/phone/signup).
 *
 * Only `verifiedPhone` is matched — a number somebody typed on an account
 * proves nothing, and matching it would let anyone who typed a stranger's
 * number into their own account receive that stranger's sign-in. An account
 * whose number was typed but never proved is reached by its e-mail, and
 * proves the number from "Connexion et sécurité".
 *
 * Wrong: `invalid_field` / `code` with `reason` "wrong", "expired" (or never
 * sent) or "too_many" (that code is dead; send another).
 */
export async function POST(request: Request) {
  return guard(
    async () => {
      const gate = hit(await callerKey("phone-verify"), LIMITS.phoneVerifyPerIp.limit, LIMITS.phoneVerifyPerIp.windowMs);
      if (!gate.ok) return fail("rate_limited", CUSTOMER, { "Retry-After": String(gate.retryAfter) });

      const parsed = body.safeParse(await readJson(request, 1_024));
      if (!parsed.success) return fail("bad_request", CUSTOMER);
      const phone = e164(parsed.data.phone);
      if (!phone) return fail("invalid_field", CUSTOMER, undefined, { field: "phone" });

      const checked = await checkCode(phone, "login", parsed.data.code);
      if (!checked.ok) return fail("invalid_field", CUSTOMER, undefined, { field: "code", reason: checked.reason });

      const user = await prisma.user.findUnique({ where: { verifiedPhone: phone }, select: ACCOUNT_SELECT });
      if (!user) {
        const ticket = await issueTicket(checked.id);
        return ok({ ticket, needsAccount: true }, CUSTOMER);
      }
      const token = await issueCustomerSession(user.id, deviceLabel(parsed.data.device));
      return ok({ token, account: accountView(user) }, CUSTOMER);
    },
    "auth phone verify",
    CUSTOMER,
  );
}
