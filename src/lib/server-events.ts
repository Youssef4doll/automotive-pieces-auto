import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";

/**
 * Funnel events only the server can see — an order placed, moved, delivered,
 * cancelled — written into the same AnalyticsEvent table as the app's and
 * the website's own, so the dashboard reads one funnel. Session "server";
 * the customer's account, when the order has one, as userId. Ids, counts,
 * amounts and statuses only: never a name, phone, address or token.
 *
 * Best effort and never in the customer's way: call it through
 * lib/defer afterResponse; a failure is logged and dropped.
 */
async function record(name: string, userId: string | null, properties: Record<string, unknown>) {
  try {
    await prisma.analyticsEvent.create({
      data: { name, sessionId: "server", userId, properties: JSON.parse(JSON.stringify({ ...properties, server: true })) },
    });
  } catch (e) {
    console.error(`[events] ${name} not recorded —`, e);
  }
}

/** order_placed: the value, the lines, how many were not confirmed for the car. */
export async function orderPlacedEvent(orderId: string) {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      ref: true,
      userId: true,
      total: true,
      paymentMethod: true,
      deliveryMethod: true,
      governorate: true,
      source: true,
      vehicleEngineId: true,
      items: { select: { qty: true, fit: true } },
    },
  });
  if (!o) return;
  await record("order_placed", o.userId, {
    ref: o.ref,
    value: toNumber(o.total),
    items: o.items.reduce((n, i) => n + i.qty, 0),
    lines: o.items.length,
    // Lines the fitment table did not confirm for the order's car.
    toCheckLines: o.vehicleEngineId ? o.items.filter((i) => i.fit !== "VERIFIED").length : null,
    payment: o.paymentMethod,
    delivery: o.deliveryMethod,
    governorate: o.governorate,
    source: o.source,
  });
}

/**
 * order_status_changed (from, to, minutes in the previous state), plus
 * order_delivered (hours since it was placed) and order_cancelled (by whom).
 */
export async function orderStatusEvent(orderId: string, from: string, to: string, by: "customer" | "shop") {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { ref: true, userId: true, createdAt: true, history: { orderBy: { createdAt: "desc" }, take: 2, select: { createdAt: true } } },
  });
  if (!o) return;
  const now = Date.now();
  // history[0] is the move just made; history[1] the one before it.
  const since = o.history[1]?.createdAt ?? o.createdAt;
  await record("order_status_changed", o.userId, { ref: o.ref, from, to, by, minutesInState: Math.round((now - since.getTime()) / 60_000) });
  if (to === "DELIVERED") await record("order_delivered", o.userId, { ref: o.ref, hoursFromOrder: Math.round((now - o.createdAt.getTime()) / 3_600_000) });
  if (to === "CANCELLED") await record("order_cancelled", o.userId, { ref: o.ref, by, stage: from });
}
