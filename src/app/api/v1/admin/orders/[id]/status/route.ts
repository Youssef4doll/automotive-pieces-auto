import { z } from "zod";
import { adminOrderDetail, ORDER_STATUSES, setOrderStatus } from "@/lib/admin/orders";
import { fail, ok, preflightWrite, readJson } from "../../../../_lib/respond";
import { ADMIN, asAdmin } from "../../../_lib/admin";

export const OPTIONS = preflightWrite;

const body = z.object({ status: z.enum(ORDER_STATUSES as [string, ...string[]]) });

/** { status } → the order as it now stands. The customer is e-mailed exactly as from the website. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return asAdmin(request, "order status", async () => {
    const parsed = body.safeParse(await readJson(request, 1_024));
    if (!parsed.success) return fail("invalid_field", ADMIN, undefined, { field: "status" });
    const { id } = await params;
    if (!(await setOrderStatus(id, parsed.data.status as (typeof ORDER_STATUSES)[number]))) return fail("not_found", ADMIN);
    return ok(await adminOrderDetail(id), ADMIN);
  });
}
