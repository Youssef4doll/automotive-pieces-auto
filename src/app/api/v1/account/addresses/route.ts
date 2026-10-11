import { prisma } from "@/lib/prisma";
import { hit } from "@/lib/rate-limit";
import { ADDRESS_SELECT, addressBody, addressData, addressView, MAX_ADDRESSES } from "@/lib/saved-addresses";
import { fail, ok, preflightWrite, readJson } from "../../_lib/respond";
import { asCustomer, CUSTOMER } from "../../_lib/customer";

export const OPTIONS = preflightWrite;

/**
 * The account's delivery addresses — "Maison", "Travail" — so a checkout is
 * a tap (lib/saved-addresses). The last one used first. Bearer only, like
 * every account route: the website's cookie is never read here.
 */
export async function GET(request: Request) {
  return asCustomer(request, "addresses GET", async (customer) => {
    const rows = await prisma.savedAddress.findMany({
      where: { userId: customer.id },
      orderBy: [{ lastUsedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      select: ADDRESS_SELECT,
    });
    return ok({ addresses: rows.map(addressView) }, CUSTOMER);
  });
}

export async function POST(request: Request) {
  return asCustomer(request, "addresses POST", async (customer) => {
    const gate = hit(`addresses:${customer.id}`, 30, 60 * 60 * 1000);
    if (!gate.ok) return fail("rate_limited", CUSTOMER, { "Retry-After": String(gate.retryAfter) });
    const parsed = addressBody.safeParse(await readJson(request, 4_096));
    if (!parsed.success) {
      return fail("invalid_field", CUSTOMER, undefined, { field: String(parsed.error.issues[0]?.path[0] ?? "address") });
    }
    const count = await prisma.savedAddress.count({ where: { userId: customer.id } });
    if (count >= MAX_ADDRESSES) return fail("invalid_field", CUSTOMER, undefined, { field: "address", reason: "too_many" });
    const row = await prisma.savedAddress.create({
      data: { userId: customer.id, ...addressData(parsed.data) },
      select: ADDRESS_SELECT,
    });
    return ok({ address: addressView(row) }, CUSTOMER);
  });
}
