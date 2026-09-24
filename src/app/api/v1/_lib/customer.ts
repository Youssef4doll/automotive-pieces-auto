import "server-only";
import { customerForRequest, type AppCustomer } from "@/lib/customer-session";
import { fail, guard } from "./respond";

/**
 * Every signed-in customer route goes through this.
 *
 * `cors: "write"` for the reason it is safe on the orders and admin routes:
 * nothing here reads a cookie. The only credential is the bearer token the
 * app keeps in the device keychain, which a hostile page cannot attach.
 * These routes must never call `cookies()` or `getCurrentUser()`.
 *
 * Identity comes from the token and nothing else. No route under /account
 * reads a user id from its body or its URL.
 */
export const CUSTOMER = { cors: "write" } as const;

export function asCustomer(request: Request, label: string, run: (customer: AppCustomer) => Promise<Response>) {
  return guard(
    async () => {
      const customer = await customerForRequest(request);
      if (!customer) return fail("unauthorized", CUSTOMER);
      return run(customer);
    },
    `account ${label}`,
    CUSTOMER,
  );
}

/** The account as the app may show it. */
export function accountView(c: AppCustomer) {
  return { name: c.name, email: c.email, phone: c.phone, createdAt: c.createdAt.toISOString() };
}
