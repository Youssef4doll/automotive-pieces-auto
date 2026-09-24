import { z } from "zod";
import { orderIdForToken } from "@/lib/order-token";
import { claimOrderIds } from "@/lib/orders/claim";
import { fail, ok, preflightWrite, readJson } from "../../../_lib/respond";
import { asCustomer, CUSTOMER } from "../../../_lib/customer";

export const OPTIONS = preflightWrite;

const body = z.object({
  orders: z
    .array(z.object({ ref: z.string().trim().toUpperCase().min(3).max(32), token: z.string().max(64) }))
    .max(50),
});

/**
 * Bring the orders this phone placed as a guest into the account it has just
 * signed in to: `{ orders: [{ ref, token }] }` → `{ claimed }`.
 *
 * The proof is each order's own token, which only the phone that placed or
 * recovered the order holds. Never the e-mail typed at checkout. An order
 * that already belongs to an account is left where it is.
 */
export async function POST(request: Request) {
  return asCustomer(request, "orders claim", async (customer) => {
    const parsed = body.safeParse(await readJson(request, 8_192));
    if (!parsed.success) return fail("bad_request", CUSTOMER);
    const ids: string[] = [];
    for (const { ref, token } of parsed.data.orders) {
      const id = await orderIdForToken(ref, token);
      if (id) ids.push(id);
    }
    return ok({ claimed: await claimOrderIds(customer.id, ids) }, CUSTOMER);
  });
}
