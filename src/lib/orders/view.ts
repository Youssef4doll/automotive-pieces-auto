import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";

/**
 * One order, as the phone that placed it may see it.
 *
 * Everything the customer typed or was charged, and the dated status
 * history — the tracking timeline is built from real rows, never from a
 * schedule. What is NOT here:
 *
 *   the note an admin can attach to a status change, which is written for
 *   the shop and may say things like "client injoignable, rappeler";
 *
 *   the marketing attribution, the purchase prices, anything about the
 *   account the order belongs to.
 *
 * The item's part category comes along so the app can draw the family for
 * the line instead of a photograph it does not have. `productId` is null for
 * a part since deleted from the catalogue; the line still shows, because it
 * is what was bought.
 */
export async function appOrderView(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      ref: true,
      status: true,
      createdAt: true,
      customerName: true,
      phone: true,
      email: true,
      governorate: true,
      address: true,
      deliveryMethod: true,
      paymentMethod: true,
      subtotal: true,
      shippingFee: true,
      stampDuty: true,
      total: true,
      vehicleLabel: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          productId: true,
          name: true,
          sku: true,
          qty: true,
          unitPrice: true,
          lineTotal: true,
          backorder: true,
          fit: true,
          product: {
            select: { slug: true, active: true, category: { select: { slug: true, parent: { select: { slug: true } } } } },
          },
        },
      },
      history: { orderBy: { createdAt: "asc" }, select: { status: true, createdAt: true } },
    },
  });
  if (!order) return null;

  return {
    ref: order.ref,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    history: order.history.map((h) => ({ status: h.status, at: h.createdAt.toISOString() })),
    customerName: order.customerName,
    phone: order.phone,
    email: order.email,
    governorate: order.governorate,
    address: order.address,
    deliveryMethod: order.deliveryMethod,
    paymentMethod: order.paymentMethod,
    vehicleLabel: order.vehicleLabel,
    items: order.items.map((i) => ({
      productId: i.productId,
      // Only a part still on sale can be opened or bought again.
      slug: i.product?.active ? i.product.slug : null,
      familySlug: i.product ? (i.product.category.parent?.slug ?? i.product.category.slug) : null,
      name: i.name,
      sku: i.sku,
      qty: i.qty,
      unitPrice: toNumber(i.unitPrice),
      lineTotal: toNumber(i.lineTotal),
      backorder: i.backorder,
      fit: i.fit,
    })),
    subtotal: toNumber(order.subtotal),
    shippingFee: toNumber(order.shippingFee),
    stampDuty: toNumber(order.stampDuty),
    total: toNumber(order.total),
  };
}

export type AppOrderView = NonNullable<Awaited<ReturnType<typeof appOrderView>>>;
