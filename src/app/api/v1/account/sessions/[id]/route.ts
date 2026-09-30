import { revokeOtherCustomerSessions } from "@/lib/customer-session";
import { fail, ok, preflightWrite } from "../../../_lib/respond";
import { asCustomer, CUSTOMER } from "../../../_lib/customer";

export const OPTIONS = preflightWrite;

/**
 * Sign out one other phone: DELETE → { revoked: 1 }.
 *
 * The id is only ever matched inside the signed-in account's own sessions,
 * so another account's id is simply not found (404) — the same answer as an
 * id that never existed. This phone is signed out with DELETE /auth/session.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return asCustomer(request, "session DELETE", async (customer) => {
    const { id } = await params;
    if (!/^[a-z0-9]{10,40}$/i.test(id)) return fail("not_found", CUSTOMER);
    const revoked = await revokeOtherCustomerSessions(customer.id, customer.sessionId, id);
    return revoked ? ok({ revoked }, CUSTOMER) : fail("not_found", CUSTOMER);
  });
}
