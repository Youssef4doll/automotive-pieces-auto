import { getDashboardData } from "@/lib/data/admin";
import { toNumber } from "@/lib/money";
import { ok, preflightWrite } from "../../_lib/respond";
import { ADMIN, asAdmin } from "../_lib/admin";

/**
 * The morning glance: the website dashboard's own figures (lib/data/admin),
 * the ones a phone screen has room for. Every number is counted from orders
 * and products; nothing here is estimated.
 */
export const OPTIONS = preflightWrite;

export async function GET(request: Request) {
  return asAdmin(request, "dashboard", async (admin) => {
    const d = await getDashboardData();
    return ok(
      {
        admin: { name: admin.name },
        periods: d.periods,
        pendingCount: d.pendingCount,
        outOfStock: d.outOfStock,
        lowStockCount: d.lowStockCount,
        recentOrders: d.recentOrders.map((o) => ({
          id: o.id,
          ref: o.ref,
          customerName: o.customerName,
          status: o.status,
          total: toNumber(o.total),
          createdAt: o.createdAt.toISOString(),
        })),
        lowStock: d.lowStock.map((p) => ({ id: p.id, name: p.name, stockQty: p.stockQty, lowStockThreshold: p.lowStockThreshold })),
      },
      ADMIN,
    );
  });
}
