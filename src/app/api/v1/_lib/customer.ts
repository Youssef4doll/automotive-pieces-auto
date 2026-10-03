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

/** What a route selects to answer with an account — see `accountView`. */
export const ACCOUNT_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  verifiedPhone: true,
  passwordHash: true,
  role: true,
  createdAt: true,
} as const;

type AccountRow = { name: string; email: string | null; phone: string | null; verifiedPhone: string | null; role: string; createdAt: Date } & (
  | { passwordHash: string | null }
  | { hasPassword: boolean }
);

/**
 * The account as the app may show it. Never the hash: only whether there is
 * a password at all, which decides what "Connexion et sécurité" offers.
 * `staff` is what puts "Espace boutique" on the account screen — the door
 * itself still asks the staff API, which checks the role on every request.
 */
export function accountView(c: AccountRow) {
  return {
    name: c.name,
    email: c.email,
    phone: c.phone,
    verifiedPhone: c.verifiedPhone,
    hasPassword: "hasPassword" in c ? c.hasPassword : Boolean(c.passwordHash),
    staff: c.role === "ADMIN",
    createdAt: c.createdAt.toISOString(),
  };
}

export type { AppCustomer };
