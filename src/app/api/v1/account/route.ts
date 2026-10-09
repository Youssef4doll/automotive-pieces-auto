import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deleteCustomerAccount } from "@/lib/account-deletion";
import { findUserByEmail } from "@/lib/accounts";
import { checkCode } from "@/lib/phone-code";
import { callerKey, clear, hit, LIMITS } from "@/lib/rate-limit";
import { emailAddress, personName } from "@/lib/validation";
import { fail, ok, preflightWrite, readJson } from "../_lib/respond";
import { ACCOUNT_SELECT, accountView, asCustomer, CUSTOMER } from "../_lib/customer";

export const OPTIONS = preflightWrite;

/** The signed-in account. */
export async function GET(request: Request) {
  return asCustomer(request, "GET", async (customer) => ok({ account: accountView(customer) }, CUSTOMER));
}

const profileBody = z.object({
  name: z.string().max(200).optional(),
  email: z.string().max(300).optional(),
  password: z.string().min(1).max(200).optional(),
  code: z.string().trim().max(12).optional(),
});

/**
 * Change the name and the e-mail, from "Mon compte" in the app:
 * `{ name?, email?, password? | code? }` → `{ account }`.
 *
 * The same two fields the website's profile form edits, with the same
 * rules (`personName`, `emailAddress`, an address another account holds is
 * `taken`), the same budget of twenty changes an hour, and the same trail:
 * every field that really changed is filed in UserProfileChange as the
 * customer's own.
 *
 * The e-mail is a sign-in and a password-reset address, so a new one is
 * proved by what proves the person: the current password — or, for an
 * account opened with a phone code, the code from account/confirm-code. A
 * phone left unlocked on a counter must not be one tap from handing the
 * account to someone else's inbox. The name asks for nothing more than the
 * session. The phone is changed with a code, at account/phone.
 */
export async function PATCH(request: Request) {
  return asCustomer(request, "profile", async (customer) => {
    const gate = hit(await callerKey(`profile:${customer.id}`), 20, 60 * 60_000);
    if (!gate.ok) return fail("rate_limited", CUSTOMER, { "Retry-After": String(gate.retryAfter) });

    const parsed = profileBody.safeParse(await readJson(request, 2_048));
    if (!parsed.success || (parsed.data.name === undefined && parsed.data.email === undefined)) return fail("bad_request", CUSTOMER);

    let name = customer.name;
    if (parsed.data.name !== undefined) {
      const checked = personName.safeParse(parsed.data.name);
      if (!checked.success) return fail("invalid_field", CUSTOMER, undefined, { field: "name" });
      name = checked.data;
    }

    let email = customer.email;
    if (parsed.data.email !== undefined) {
      const checked = emailAddress().safeParse(parsed.data.email);
      if (!checked.success) return fail("invalid_field", CUSTOMER, undefined, { field: "email" });
      email = checked.data;
    }

    const emailChanged = (email ?? "") !== (customer.email ?? "");
    if (emailChanged) {
      // Proof first, on the login budget: this verifies a password.
      const key = await callerKey(`profile-proof:${customer.id}`);
      const proofGate = hit(key, LIMITS.loginPerAccount.limit, LIMITS.loginPerAccount.windowMs);
      if (!proofGate.ok) return fail("rate_limited", CUSTOMER, { "Retry-After": String(proofGate.retryAfter) });
      if (customer.hasPassword) {
        const row = await prisma.user.findUnique({ where: { id: customer.id }, select: { passwordHash: true } });
        if (!parsed.data.password || !row?.passwordHash || !(await bcrypt.compare(parsed.data.password, row.passwordHash))) {
          return fail("invalid_field", CUSTOMER, undefined, { field: "password", reason: "wrong" });
        }
      } else {
        if (!customer.verifiedPhone || !parsed.data.code) return fail("invalid_field", CUSTOMER, undefined, { field: "code", reason: "wrong" });
        const checked = await checkCode(customer.verifiedPhone, "confirm", parsed.data.code, customer.id);
        if (!checked.ok) return fail("invalid_field", CUSTOMER, undefined, { field: "code", reason: checked.reason });
      }
      clear(key);
      const taken = email ? await findUserByEmail(email, { id: true }) : null;
      if (taken && taken.id !== customer.id) return fail("invalid_field", CUSTOMER, undefined, { field: "email", reason: "taken" });
    }

    const changes = [
      { field: "name", oldValue: customer.name, newValue: name },
      { field: "email", oldValue: customer.email ?? "", newValue: email ?? "" },
    ].filter((c) => c.oldValue !== c.newValue);
    if (!changes.length) return ok({ account: accountView(customer) }, CUSTOMER);

    try {
      const [user] = await prisma.$transaction([
        prisma.user.update({ where: { id: customer.id }, data: { name, email }, select: ACCOUNT_SELECT }),
        ...changes.map((c) => prisma.userProfileChange.create({ data: { ...c, userId: customer.id, changedBy: "SELF" } })),
      ]);
      return ok({ account: accountView(user) }, CUSTOMER);
    } catch (e) {
      // Two accounts claiming one address at the same instant: the unique
      // index decides, and the loser is told the address is taken.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return fail("invalid_field", CUSTOMER, undefined, { field: "email", reason: "taken" });
      }
      throw e;
    }
  });
}

/**
 * Delete the account: `{ password }` → `{ deleted: true }`; an account with
 * no password (opened with a phone code) sends `{ code }` instead, the code
 * from account/confirm-code.
 *
 * Both stores require that an app which creates accounts can delete them
 * from inside the app. The password is asked again, because a phone left
 * unlocked on a counter must not be one tap from erasing somebody.
 *
 * What goes: the person — name, e-mail, phone, password, sessions, saved
 * baskets, profile history, reset links — and the link from their analytics
 * events and messages to them. What stays: the orders, detached from the
 * account. They are the shop's accounting records (an invoice has to be
 * kept), and they already carry the delivery details typed at checkout as a
 * snapshot, which is what the shop is obliged to retain.
 *
 * The owner's own account is refused (`forbidden`): deleting the only admin
 * from a phone would lock the shop out of its own back office.
 */
export async function DELETE(request: Request) {
  return asCustomer(request, "DELETE", async (customer) => {
    const key = await callerKey(`account-delete:${customer.id}`);
    const gate = hit(key, LIMITS.loginPerAccount.limit, LIMITS.loginPerAccount.windowMs);
    if (!gate.ok) return fail("rate_limited", CUSTOMER, { "Retry-After": String(gate.retryAfter) });

    const parsed = z
      .object({ password: z.string().min(1).max(200).optional(), code: z.string().trim().max(12).optional() })
      .safeParse(await readJson(request, 2_048));
    if (!parsed.success) return fail("invalid_field", CUSTOMER, undefined, { field: "password" });
    if (customer.role === "ADMIN") return fail("forbidden", CUSTOMER);

    if (customer.hasPassword) {
      const row = await prisma.user.findUnique({ where: { id: customer.id }, select: { passwordHash: true } });
      if (!parsed.data.password || !row?.passwordHash || !(await bcrypt.compare(parsed.data.password, row.passwordHash))) {
        return fail("invalid_field", CUSTOMER, undefined, { field: "password", reason: "wrong" });
      }
    } else {
      // No password to re-enter: the code just sent to the account's number.
      if (!customer.verifiedPhone || !parsed.data.code) return fail("invalid_field", CUSTOMER, undefined, { field: "code", reason: "wrong" });
      const checked = await checkCode(customer.verifiedPhone, "confirm", parsed.data.code, customer.id);
      if (!checked.ok) return fail("invalid_field", CUSTOMER, undefined, { field: "code", reason: checked.reason });
    }
    clear(key);

    await deleteCustomerAccount(customer.id);
    return ok({ deleted: true }, CUSTOMER);
  });
}
