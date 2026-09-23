import { adminOrderDetail } from "@/lib/admin/orders";
import { fail, ok, preflightWrite } from "../../../_lib/respond";
import { ADMIN, asAdmin } from "../../_lib/admin";

export const OPTIONS = preflightWrite;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return asAdmin(request, "order", async () => {
    const order = await adminOrderDetail((await params).id);
    return order ? ok(order, ADMIN) : fail("not_found", ADMIN);
  });
}
