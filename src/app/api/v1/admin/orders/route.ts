import type { OrderStatus } from "@prisma/client";
import { listAdminOrders, ORDER_STATUSES } from "@/lib/admin/orders";
import { ok, preflightWrite } from "../../_lib/respond";
import { ADMIN, asAdmin } from "../_lib/admin";

export const OPTIONS = preflightWrite;

/** ?status=PENDING&q=CMD-10&cursor=<id> */
export async function GET(request: Request) {
  return asAdmin(request, "orders", async () => {
    const url = new URL(request.url);
    const raw = url.searchParams.get("status") ?? "";
    const status = (ORDER_STATUSES as string[]).includes(raw) ? (raw as OrderStatus) : undefined;
    const q = url.searchParams.get("q")?.trim().slice(0, 80) || undefined;
    const cursor = url.searchParams.get("cursor") || undefined;
    return ok(await listAdminOrders({ status, q, cursor }), ADMIN);
  });
}
