import { z } from "zod";
import { codeMessage, e164, issueCode } from "@/lib/phone-code";
import { prisma } from "@/lib/prisma";
import { hit, LIMITS, peek } from "@/lib/rate-limit";
import { sendSms, smsAvailable } from "@/lib/sms";
import { fail, ok, preflightWrite, readJson } from "../../../_lib/respond";
import { asCustomer, CUSTOMER } from "../../../_lib/customer";

export const OPTIONS = preflightWrite;

const body = z.object({ phone: z.string().trim().max(30), locale: z.enum(["fr", "en", "ar"]).optional() });

/**
 * Signed in: "send a code to this number so I can sign in with it".
 * `{ phone, locale? }` → `{ sent: true }`. A number another account already
 * proved is refused as "taken" before anything is sent: the person asking is
 * signed in, so this tells them nothing they could not try at the sign-in
 * door anyway, and it saves an SMS that could never be used.
 */
export async function POST(request: Request) {
  return asCustomer(request, "phone code", async (customer) => {
    if (!smsAvailable()) return fail("temporarily_unavailable", CUSTOMER);
    const parsed = body.safeParse(await readJson(request, 1_024));
    if (!parsed.success) return fail("bad_request", CUSTOMER);
    const phone = e164(parsed.data.phone);
    if (!phone) return fail("invalid_field", CUSTOMER, undefined, { field: "phone" });
    if (phone === customer.verifiedPhone) return fail("invalid_field", CUSTOMER, undefined, { field: "phone", reason: "same" });
    const holder = await prisma.user.findUnique({ where: { verifiedPhone: phone }, select: { id: true } });
    if (holder && holder.id !== customer.id) return fail("invalid_field", CUSTOMER, undefined, { field: "phone", reason: "taken" });

    const quarter = `phone-code:n:${phone}`;
    const day = `phone-code:d:${phone}`;
    if (!peek(quarter, LIMITS.phoneCodePerNumber.limit).ok || !peek(day, LIMITS.phoneCodePerNumberDay.limit).ok) {
      const gate = peek(quarter, LIMITS.phoneCodePerNumber.limit);
      return fail("rate_limited", CUSTOMER, { "Retry-After": String(Math.max(gate.retryAfter, 60)) });
    }
    hit(quarter, LIMITS.phoneCodePerNumber.limit, LIMITS.phoneCodePerNumber.windowMs);
    hit(day, LIMITS.phoneCodePerNumberDay.limit, LIMITS.phoneCodePerNumberDay.windowMs);
    const code = await issueCode(phone, "link", customer.id);
    await sendSms(phone, codeMessage(code, parsed.data.locale ?? "fr", "link"));
    return ok({ sent: true, expiresIn: 600 }, CUSTOMER);
  });
}
