import { Prisma } from "@prisma/client";
import { z } from "zod";
import { checkCode, e164 } from "@/lib/phone-code";
import { prisma } from "@/lib/prisma";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { fail, ok, preflightWrite, readJson } from "../../_lib/respond";
import { ACCOUNT_SELECT, accountView, asCustomer, CUSTOMER } from "../../_lib/customer";

export const OPTIONS = preflightWrite;

const body = z.object({ phone: z.string().trim().max(30), code: z.string().trim().max(12) });

/**
 * Signed in, with the code just received: `{ phone, code }` → `{ account }`.
 * From now on this number signs in to this account with a code. It replaces
 * the account's previous proved number, and becomes its contact phone too.
 */
export async function POST(request: Request) {
  return asCustomer(request, "phone link", async (customer) => {
    const gate = hit(await callerKey("phone-verify"), LIMITS.phoneVerifyPerIp.limit, LIMITS.phoneVerifyPerIp.windowMs);
    if (!gate.ok) return fail("rate_limited", CUSTOMER, { "Retry-After": String(gate.retryAfter) });
    const parsed = body.safeParse(await readJson(request, 1_024));
    if (!parsed.success) return fail("bad_request", CUSTOMER);
    const phone = e164(parsed.data.phone);
    if (!phone) return fail("invalid_field", CUSTOMER, undefined, { field: "phone" });

    const checked = await checkCode(phone, "link", parsed.data.code, customer.id);
    if (!checked.ok) return fail("invalid_field", CUSTOMER, undefined, { field: "code", reason: checked.reason });

    try {
      const [user] = await prisma.$transaction([
        prisma.user.update({ where: { id: customer.id }, data: { verifiedPhone: phone, phone: phone.slice(4) }, select: ACCOUNT_SELECT }),
        prisma.userProfileChange.create({
          data: { userId: customer.id, field: "phone", oldValue: customer.phone ?? "", newValue: phone.slice(4), changedBy: "SELF" },
        }),
      ]);
      return ok({ account: accountView(user) }, CUSTOMER);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return fail("invalid_field", CUSTOMER, undefined, { field: "phone", reason: "taken" });
      }
      throw e;
    }
  });
}
