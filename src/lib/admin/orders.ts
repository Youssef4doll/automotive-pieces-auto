import "server-only";
import { revalidatePath } from "next/cache";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import { taxBreakdown } from "@/lib/tax";
import { notifyOrderStatus } from "@/lib/order-emails";

/**
 * The shop's order desk, shared by the website admin (server actions) and the
 * app's staff screens (/api/v1/admin). One copy of each rule: whichever door
 * the owner uses, an order moves the same way and the customer hears the same
 * thing.
 */

export const ORDER_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARED", "SHIPPED", "DELIVERED", "CANCELLED"];

/**
 * Move an order to `status`. Returns false when there is no such order.
 *
 * Choosing the status it already has does nothing. It used to add a second
 * identical history row and send the customer the same e-mail again — one
 * stray tap on the highlighted button was enough.
 */
export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<boolean> {
  const current = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!current) return false;
  if (current.status === status) return true;
  await prisma.order.update({
    where: { id: orderId },
    data: { status, history: { create: { status } } },
  });
  // Best-effort by design — see lib/order-emails — so a mail failure never
  // leaves the shop unable to advance an order.
  await notifyOrderStatus(orderId, status);
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/compte/commandes");
  return true;
}

/** The list the website's /admin/commandes filters, paged for a phone. */
export async function listAdminOrders({
  status,
  q,
  cursor,
  take = 30,
}: {
  status?: OrderStatus;
  q?: string;
  cursor?: string;
  take?: number;
}) {
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { ref: { contains: q, mode: "insensitive" } },
            { customerName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const rows = await prisma.order.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      ref: true,
      customerName: true,
      status: true,
      total: true,
      createdAt: true,
      deliveryMethod: true,
      governorate: true,
      _count: { select: { items: true } },
      items: { where: { backorder: true }, select: { id: true }, take: 1 },
    },
  });
  const page = rows.slice(0, take);
  return {
    orders: page.map((o) => ({
      id: o.id,
      ref: o.ref,
      customerName: o.customerName,
      status: o.status,
      total: toNumber(o.total),
      createdAt: o.createdAt.toISOString(),
      deliveryMethod: o.deliveryMethod,
      governorate: o.governorate,
      lines: o._count.items,
      hasBackorder: o.items.length > 0,
    })),
    next: rows.length > take ? page[page.length - 1].id : null,
  };
}

/** Everything the website's order page shows the shop, as data. */
export async function adminOrderDetail(orderId: string) {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { id: "asc" } },
      history: { orderBy: { createdAt: "asc" } },
      user: { select: { email: true } },
    },
  });
  if (!o) return null;
  const tax = taxBreakdown({
    subtotal: toNumber(o.subtotal),
    shippingFee: toNumber(o.shippingFee),
    vatRate: toNumber(o.vatRate),
    stampDuty: toNumber(o.stampDuty),
  });
  return {
    id: o.id,
    ref: o.ref,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    customerName: o.customerName,
    phone: o.phone,
    email: o.email,
    accountEmail: o.user?.email ?? null,
    governorate: o.governorate,
    address: o.address,
    deliveryMethod: o.deliveryMethod,
    paymentMethod: o.paymentMethod,
    notes: o.notes,
    vehicleLabel: o.vehicleLabel,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      name: i.name,
      sku: i.sku,
      qty: i.qty,
      unitPrice: toNumber(i.unitPrice),
      lineTotal: toNumber(i.lineTotal),
      backorder: i.backorder,
      fit: i.fit,
    })),
    totals: {
      taxed: tax.taxed,
      goods: tax.goodsHT,
      shipping: toNumber(o.shippingFee) === 0 ? 0 : tax.shippingHT,
      vatRate: tax.vatRate,
      vat: tax.vat,
      stampDuty: tax.stampDuty,
      total: toNumber(o.total),
    },
    history: o.history.map((h) => ({ status: h.status, at: h.createdAt.toISOString(), note: h.note })),
  };
}
