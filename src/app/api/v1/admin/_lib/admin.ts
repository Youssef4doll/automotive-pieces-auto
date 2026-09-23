import "server-only";
import { adminForRequest, type AppAdmin } from "@/lib/admin-session";
import { fail, guard } from "../../_lib/respond";

/**
 * Every /api/v1/admin route goes through this.
 *
 * `cors: "write"` is safe here for the reason it is safe on the orders
 * routes: nothing under /admin reads a cookie. The only credential is the
 * bearer token the app keeps in the device keychain, which a hostile page
 * cannot attach. These routes must never call `cookies()` or
 * `getCurrentUser()` — the website admin's cookie is not honoured here, on
 * purpose, and the app's token is not honoured on the website.
 *
 * Responses are `no-store` (the respond.ts default): an admin answer is
 * never the same for two people and must not sit in any shared cache.
 */
export const ADMIN = { cors: "write" } as const;

export function asAdmin(request: Request, label: string, run: (admin: AppAdmin) => Promise<Response>) {
  return guard(
    async () => {
      const admin = await adminForRequest(request);
      if (!admin) return fail("unauthorized", ADMIN);
      return run(admin);
    },
    `admin ${label}`,
    ADMIN,
  );
}
