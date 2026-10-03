import { z } from "zod";
import { codeMessage, issueCode, maskPhone } from "@/lib/phone-code";
import { hit, LIMITS, peek } from "@/lib/rate-limit";
import { sendSms, smsAvailable } from "@/lib/sms";
import { fail, ok, preflightWrite, readJson } from "../../_lib/respond";
import { asCustomer, CUSTOMER } from "../../_lib/customer";

export const OPTIONS = preflightWrite;

/**
 * An account with no password confirms what a password would (deleting the
 * account) with a code to its proved number: `{ locale? }` → `{ sent, to }`,
 * `to` being the number masked ("•• ••• 432") so the screen can say where.
 */
export async function POST(request: Request) {
  return asCustomer(request, "confirm code", async (customer) => {
    if (!customer.verifiedPhone) return fail("invalid_field", CUSTOMER, undefined, { field: "phone" });
    if (!smsAvailable()) return fail("temporarily_unavailable", CUSTOMER);
    const parsed = z.object({ locale: z.enum(["fr", "en", "ar"]).optional() }).safeParse((await readJson(request, 512)) ?? {});
    if (!parsed.success) return fail("bad_request", CUSTOMER);

    const phone = customer.verifiedPhone;
    const quarter = `phone-code:n:${phone}`;
    const gate = peek(quarter, LIMITS.phoneCodePerNumber.limit);
    if (!gate.ok) return fail("rate_limited", CUSTOMER, { "Retry-After": String(gate.retryAfter) });
    hit(quarter, LIMITS.phoneCodePerNumber.limit, LIMITS.phoneCodePerNumber.windowMs);
    const code = await issueCode(phone, "confirm", customer.id);
    await sendSms(phone, codeMessage(code, parsed.data.locale ?? "fr", "confirm"));
    return ok({ sent: true, to: maskPhone(phone) }, CUSTOMER);
  });
}
