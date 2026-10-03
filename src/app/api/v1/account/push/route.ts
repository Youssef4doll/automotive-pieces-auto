import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { EXPO_TOKEN, pushLocale } from "@/lib/push-copy";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { fail, ok, preflightWrite, readJson } from "../../_lib/respond";
import { asCustomer, CUSTOMER } from "../../_lib/customer";

export const OPTIONS = preflightWrite;

const body = z.object({ token: z.string().regex(EXPO_TOKEN), locale: z.string().max(5).optional() });

/**
 * This phone, signed in, may be told: `{ token, locale? }` → `{ ok }`.
 * Kept on the session, so every order of the account — placed here or on
 * the website — reaches this phone as it moves (lib/push), and it stops the
 * moment the session ends. DELETE forgets it (notifications switched off).
 */
export async function POST(request: Request) {
  return asCustomer(request, "push POST", async (customer) => {
    const gate = hit(await callerKey("push-register"), LIMITS.pushRegister.limit, LIMITS.pushRegister.windowMs);
    if (!gate.ok) return fail("rate_limited", CUSTOMER, { "Retry-After": String(gate.retryAfter) });
    const parsed = body.safeParse(await readJson(request, 1_024));
    if (!parsed.success) return fail("invalid_field", CUSTOMER, undefined, { field: "token" });
    await prisma.$transaction([
      // One phone, one session to be told on: a token left on an older
      // session of this account (signed in again) would say everything twice.
      prisma.customerSession.updateMany({
        where: { pushToken: parsed.data.token, NOT: { id: customer.sessionId } },
        data: { pushToken: null },
      }),
      prisma.customerSession.update({
        where: { id: customer.sessionId },
        data: { pushToken: parsed.data.token, pushLocale: pushLocale(parsed.data.locale) },
      }),
    ]);
    return ok({ ok: true }, CUSTOMER);
  });
}

export async function DELETE(request: Request) {
  return asCustomer(request, "push DELETE", async (customer) => {
    await prisma.customerSession.update({ where: { id: customer.sessionId }, data: { pushToken: null } });
    return ok({ ok: true }, CUSTOMER);
  });
}
