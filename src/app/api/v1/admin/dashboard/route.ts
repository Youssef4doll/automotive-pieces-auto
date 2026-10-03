import { getDashboardData } from "@/lib/data/admin";
import { toNumber } from "@/lib/money";
import { openReturnCounts } from "@/lib/returns";
import { prisma } from "@/lib/prisma";
import { getSettings, publicContact } from "@/lib/settings";
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
    const [d, returns, messagesWaiting, settings] = await Promise.all([
      getDashboardData(),
      openReturnCounts().catch(() => undefined),
      prisma.contactMessage.count({ where: { status: "NEW" } }),
      getSettings(),
    ]);
    const contact = publicContact(settings);
    return ok(
      {
        admin: { name: admin.name },
        periods: d.periods,
        pendingCount: d.pendingCount,
        outOfStock: d.outOfStock,
        lowStockCount: d.lowStockCount,
        /** Return requests waiting on the shop: to answer, the part to arrive, to settle. */
        returns,
        /** Questions, photo requests and contact messages nobody has dealt with yet. */
        messagesWaiting,
        /**
         * What customers cannot see yet because the shop has not filled it in
         * (placeholders count as empty): no WhatsApp or phone means no "call
         * / WhatsApp" button anywhere in the app; no address means no
         * collection in store at checkout. Shown to staff as a to-do.
         */
        missing: [
          ...(contact.whatsapp ? [] : ["whatsapp" as const]),
          ...(contact.phone ? [] : ["phone" as const]),
          ...(contact.address ? [] : ["address" as const]),
          ...(contact.email ? [] : ["email" as const]),
        ],
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
