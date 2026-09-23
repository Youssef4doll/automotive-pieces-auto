import { z } from "zod";
import { checkCredentials } from "@/lib/credentials";
import { issueAdminSession, revokeAdminSession } from "@/lib/admin-session";
import { fail, guard, ok, preflightWrite, readJson } from "../../_lib/respond";
import { ADMIN, asAdmin } from "../_lib/admin";

/**
 * The app's staff door.
 *
 *   POST    { email, password } → { token, admin }   sign in
 *   GET     (Bearer)            → { admin }          "am I still signed in?"
 *   DELETE  (Bearer)            → { ok }             sign out
 *
 * The password check is the website's own (lib/credentials): the same
 * accounts, the same lockout budget, the same timing. Only an ADMIN gets a
 * session; a customer with the right password is told `forbidden` rather
 * than "wrong password", because they are not guessing — they already hold
 * the password and would only be sent round in circles.
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
      if (!parsed.success) return fail("bad_request", ADMIN);

      const checked = await checkCredentials(parsed.data.email, parsed.data.password);
      if (!checked.ok) {
        return checked.reason === "rate_limited"
          ? fail("rate_limited", ADMIN, { "Retry-After": String(checked.retryAfter) })
          : fail("unauthorized", ADMIN);
      }
      if (checked.user.role !== "ADMIN") return fail("forbidden", ADMIN);

      const token = await issueAdminSession(checked.user.id);
      return ok({ token, admin: { name: checked.user.name, email: checked.user.email } }, ADMIN);
    },
    "admin session POST",
    ADMIN,
  );
}

export async function GET(request: Request) {
  return asAdmin(request, "session GET", async (admin) => ok({ admin: { name: admin.name, email: admin.email } }, ADMIN));
}

export async function DELETE(request: Request) {
  return guard(
    async () => {
      // Answered the same whether or not the token was live: signing out of a
      // session that has already ended is still signed out.
      await revokeAdminSession(request);
      return ok({ ok: true }, ADMIN);
    },
    "admin session DELETE",
    ADMIN,
  );
}
