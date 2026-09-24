import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import { ok, preflightWrite } from "../../_lib/respond";
import { asCustomer, CUSTOMER } from "../../_lib/customer";

export const OPTIONS = preflightWrite;

/**
 * "Mes commandes" for the signed-in account, on any phone: the list only.
 * Each order is then opened at /api/v1/orders/:ref with the same session.
 */
export async function GET(request: Request) {
  return asCustomer(request, "orders GET", async (customer) => {
    const orders = await prisma.order.findMany({
      where: { userId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        ref: true,
        status: true,
        createdAt: true,
        total: true,
        items: { select: { qty: true } },
      },
    });
    return ok(
      orders.map((o) => ({
        ref: o.ref,
        status: o.status,
        placedAt: o.createdAt.toISOString(),
        total: toNumber(o.total),
        itemCount: o.items.reduce((n, i) => n + i.qty, 0),
      })),
      CUSTOMER,
    );
  });
}
