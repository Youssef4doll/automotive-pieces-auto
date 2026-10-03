import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deleteCustomerAccount } from "@/lib/account-deletion";
import { checkCode } from "@/lib/phone-code";
import { callerKey, clear, hit, LIMITS } from "@/lib/rate-limit";
import { fail, ok, preflightWrite, readJson } from "../_lib/respond";
import { accountView, asCustomer, CUSTOMER } from "../_lib/customer";

export const OPTIONS = preflightWrite;

/** The signed-in account. */
export async function GET(request: Request) {
  return asCustomer(request, "GET", async (customer) => ok({ account: accountView(customer) }, CUSTOMER));
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
