import { z } from "zod";
import { codeMessage, e164, issueCode } from "@/lib/phone-code";
import { callerKey, hit, LIMITS, peek } from "@/lib/rate-limit";
import { sendSms, smsAvailable } from "@/lib/sms";
import { fail, guard, ok, preflightWrite, readJson } from "../../../_lib/respond";
import { CUSTOMER } from "../../../_lib/customer";

export const OPTIONS = preflightWrite;

const body = z.object({
  phone: z.string().trim().max(30),
  locale: z.enum(["fr", "en", "ar"]).optional(),
});

/**
 * "Send me a code": `{ phone, locale? }` → `{ sent: true, expiresIn }`.
 *
 * The answer is the same whether the number has an account or not — the
 * code is what tells them apart, on the phone that receives it — and the
 * same once a number's sending budget is spent (nothing more goes out). A
 * badly formed number is the one thing said back, because the customer can
 * fix it. Without an SMS provider the route is `temporarily_unavailable`;
 * the app does not offer the option then anyway (settings `phoneLogin`).
 */
export async function POST(request: Request) {
  return guard(
    async () => {
      if (!smsAvailable()) return fail("temporarily_unavailable", CUSTOMER);
      const ipGate = hit(await callerKey("phone-code"), LIMITS.phoneCodePerIp.limit, LIMITS.phoneCodePerIp.windowMs);
      if (!ipGate.ok) return fail("rate_limited", CUSTOMER, { "Retry-After": String(ipGate.retryAfter) });

      const parsed = body.safeParse(await readJson(request, 1_024));
      if (!parsed.success) return fail("bad_request", CUSTOMER);
      const phone = e164(parsed.data.phone);
      if (!phone) return fail("invalid_field", CUSTOMER, undefined, { field: "phone" });

      const quarter = `phone-code:n:${phone}`;
      const day = `phone-code:d:${phone}`;
      const allowed =
        peek(quarter, LIMITS.phoneCodePerNumber.limit).ok && peek(day, LIMITS.phoneCodePerNumberDay.limit).ok;
      if (allowed) {
        hit(quarter, LIMITS.phoneCodePerNumber.limit, LIMITS.phoneCodePerNumber.windowMs);
        hit(day, LIMITS.phoneCodePerNumberDay.limit, LIMITS.phoneCodePerNumberDay.windowMs);
        const code = await issueCode(phone, "login");
        await sendSms(phone, codeMessage(code, parsed.data.locale ?? "fr", "login"));
      }
      return ok({ sent: true, expiresIn: 600 }, CUSTOMER);
    },
    "auth phone code",
    CUSTOMER,
  );
}
