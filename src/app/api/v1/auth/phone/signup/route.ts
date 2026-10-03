import { Prisma } from "@prisma/client";
import { z } from "zod";
import { deviceLabel, findUserByEmail } from "@/lib/accounts";
import { issueCustomerSession } from "@/lib/customer-session";
import { spendTicket } from "@/lib/phone-code";
import { prisma } from "@/lib/prisma";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { emailAddress, personName } from "@/lib/validation";
import { fail, guard, ok, preflightWrite, readJson } from "../../../_lib/respond";
import { ACCOUNT_SELECT, accountView, CUSTOMER } from "../../../_lib/customer";

export const OPTIONS = preflightWrite;

const body = z.object({
  ticket: z.string().max(100),
  name: personName,
  /** Optional: a phone account needs no e-mail, but may give one for receipts. */
  email: z.union([z.literal(""), emailAddress()]).optional(),
  device: z.string().max(200).optional(),
});

/**
 * Open an account on a number just proved by code:
 * `{ ticket, name, email? }` → `{ token, account }`.
 *
 * No password: the account signs in with a code to that number. The number
 * is both what the customer gave (`phone`) and what they proved
 * (`verifiedPhone`). An e-mail that already has an account is refused as
 * "taken" — that person signs in with it and adds the number from
 * "Connexion et sécurité" instead.
 *
 * The ticket is checked last, so a refused e-mail does not burn it; it is
 * spent atomically, so one ticket opens one account.
 */
export async function POST(request: Request) {
  return guard(
    async () => {
      const gate = hit(await callerKey("signup"), LIMITS.signup.limit, LIMITS.signup.windowMs);
      if (!gate.ok) return fail("rate_limited", CUSTOMER, { "Retry-After": String(gate.retryAfter) });

      const parsed = body.safeParse(await readJson(request, 2_048));
      if (!parsed.success) {
        const field = String(parsed.error.issues[0]?.path[0] ?? "form");
        return fail("invalid_field", CUSTOMER, undefined, { field });
      }
      const email = parsed.data.email || null;
      if (email && (await findUserByEmail(email, { id: true }))) {
        return fail("invalid_field", CUSTOMER, undefined, { field: "email", reason: "taken" });
      }

      const phone = await spendTicket(parsed.data.ticket);
      if (!phone) return fail("invalid_field", CUSTOMER, undefined, { field: "ticket", reason: "expired" });
      // Proved by somebody else in the fifteen minutes since: theirs now.
      if (await prisma.user.findUnique({ where: { verifiedPhone: phone }, select: { id: true } })) {
        return fail("invalid_field", CUSTOMER, undefined, { field: "phone", reason: "taken" });
      }

      let user;
      try {
        user = await prisma.user.create({
          data: { name: parsed.data.name, email, phone: phone.slice(4), verifiedPhone: phone, role: "CUSTOMER" },
          select: ACCOUNT_SELECT,
        });
      } catch (e) {
        // Two sign-ups racing on one number or one address: the loser is told which.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const target = String((e.meta as { target?: unknown } | undefined)?.target ?? "");
          return fail("invalid_field", CUSTOMER, undefined, { field: target.includes("email") ? "email" : "phone", reason: "taken" });
        }
        throw e;
      }
      const token = await issueCustomerSession(user.id, deviceLabel(parsed.data.device));
      return ok({ token, account: accountView(user) }, CUSTOMER);
    },
    "auth phone signup",
    CUSTOMER,
  );
}
