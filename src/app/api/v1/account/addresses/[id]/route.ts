import { prisma } from "@/lib/prisma";
import { hit } from "@/lib/rate-limit";
import { ADDRESS_SELECT, addressBody, addressData, addressView } from "@/lib/saved-addresses";
import { fail, ok, preflightWrite, readJson } from "../../../_lib/respond";
import { asCustomer, CUSTOMER } from "../../../_lib/customer";

export const OPTIONS = preflightWrite;

type Params = { params: Promise<{ id: string }> };

/** Change one of the account's addresses. Someone else's id is "not found", never "forbidden". */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return asCustomer(request, "address PATCH", async (customer) => {
    const gate = hit(`addresses:${customer.id}`, 30, 60 * 60 * 1000);
    if (!gate.ok) return fail("rate_limited", CUSTOMER, { "Retry-After": String(gate.retryAfter) });
    const parsed = addressBody.safeParse(await readJson(request, 4_096));
    if (!parsed.success) {
      return fail("invalid_field", CUSTOMER, undefined, { field: String(parsed.error.issues[0]?.path[0] ?? "address") });
    }
    const updated = await prisma.savedAddress.updateMany({ where: { id, userId: customer.id }, data: addressData(parsed.data) });
    if (updated.count !== 1) return fail("not_found", CUSTOMER);
    const row = await prisma.savedAddress.findUnique({ where: { id }, select: ADDRESS_SELECT });
    return ok({ address: addressView(row!) }, CUSTOMER);
  });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  return asCustomer(request, "address DELETE", async (customer) => {
    const gone = await prisma.savedAddress.deleteMany({ where: { id, userId: customer.id } });
    if (gone.count !== 1) return fail("not_found", CUSTOMER);
    return ok({ ok: true }, CUSTOMER);
  });
}
