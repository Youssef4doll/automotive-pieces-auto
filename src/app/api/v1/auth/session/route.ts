import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkCredentials } from "@/lib/credentials";
import { issueCustomerSession, revokeCustomerSession } from "@/lib/customer-session";
import { fail, guard, ok, preflightWrite, readJson } from "../../_lib/respond";
import { accountView, asCustomer, CUSTOMER } from "../../_lib/customer";

/**
 * The app's customer door.
 *
 *   POST    { email, password } → { token, account }   sign in
 *   GET     (Bearer)            → { account }          "am I still signed in?"
 *   DELETE  (Bearer)            → { ok }               sign out
 *
 * The password check is lib/credentials — the website form's and the staff
 * door's — so the three share one lockout budget and one timing. Any account
 * may shop, the owner's included; a customer session never opens /gestion,
 * which has its own table.
 */

export const OPTIONS = preflightWrite;

const body = z.object({
  email: z.string().trim().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  return guard(
    async () => {
      const parsed = body.safeParse(await readJson(request, 4_096));
      if (!parsed.success) return fail("bad_request", CUSTOMER);

      const checked = await checkCredentials(parsed.data.email, parsed.data.password);
      if (!checked.ok) {
        return checked.reason === "rate_limited"
          ? fail("rate_limited", CUSTOMER, { "Retry-After": String(checked.retryAfter) })
          : fail("unauthorized", CUSTOMER);
      }
      const user = await prisma.user.findUnique({
        where: { id: checked.user.id },
        select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
      });
      if (!user) return fail("unauthorized", CUSTOMER);
      const token = await issueCustomerSession(user.id);
      return ok({ token, account: accountView(user) }, CUSTOMER);
    },
    "auth session POST",
    CUSTOMER,
  );
}

export async function GET(request: Request) {
  return asCustomer(request, "session GET", async (customer) => ok({ account: accountView(customer) }, CUSTOMER));
}

export async function DELETE(request: Request) {
  return guard(
    async () => {
      // The same answer whether or not the token was live.
      await revokeCustomerSession(request);
      return ok({ ok: true }, CUSTOMER);
    },
    "auth session DELETE",
    CUSTOMER,
  );
}
