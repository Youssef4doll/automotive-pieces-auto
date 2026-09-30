import { listCustomerSessions, revokeOtherCustomerSessions } from "@/lib/customer-session";
import { ok, preflightWrite } from "../../_lib/respond";
import { asCustomer, CUSTOMER } from "../../_lib/customer";

export const OPTIONS = preflightWrite;

/**
 * The phones signed in to this account.
 *
 *   GET     → { sessions: [{ id, device, signedInAt, lastUsedAt, current }] }
 *   DELETE  → { revoked: n }   every phone but this one signed out
 *
 * `device` is what each phone called itself at sign-in, and may be null for a
 * session made before the app sent one. `current` marks the phone asking.
 * Only this account's sessions, found through the token — never an id from
 * the URL or the body.
 */
export async function GET(request: Request) {
  return asCustomer(request, "sessions GET", async (customer) =>
    ok({ sessions: await listCustomerSessions(customer.id, customer.sessionId) }, CUSTOMER),
  );
}

export async function DELETE(request: Request) {
  return asCustomer(request, "sessions DELETE", async (customer) =>
    ok({ revoked: await revokeOtherCustomerSessions(customer.id, customer.sessionId) }, CUSTOMER),
  );
}
