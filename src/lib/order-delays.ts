import "server-only";
import { prisma } from "@/lib/prisma";
import { estimateDeadline, parseWindow } from "@/lib/delivery-estimate";
import { textOrderDelay } from "@/lib/order-texts";
import { pushOrderDelay } from "@/lib/push";

/**
 * Saying a delay before the customer has to ask (the owner, October 2026).
 *
 * An order that was promised a date (lib/order-estimate) is late when:
 *
 *   - it has not left yet and its first promised day has begun — a parcel
 *     still on the shelf the morning it should arrive will not arrive; or
 *   - it left, and the last promised day's courier hours are over.
 *
 * Each such order is told once — push to the phones following it and a text
 * (lib/order-texts) — and marked `delayNotifiedAt`, which the order screen
 * shows and which no later sweep repeats. The claim is a conditional update,
 * so two sweeps running at once still tell a customer once.
 *
 * Run by Vercel's daily cron at 08:00 in Tunis (app/api/cron/late-orders)
 * and, between those, whenever the shop opens its order list (at most every
 * ten minutes per server) — the moment a delay is most likely to be noticed
 * and fixed.
 */
export async function sweepLateOrders(now = new Date()): Promise<string[]> {
  const candidates = await prisma.order.findMany({
    where: {
      deliveryMethod: "DELIVERY",
      status: { in: ["PENDING", "CONFIRMED", "PREPARED", "SHIPPED"] },
      estimatedFrom: { not: null },
      estimatedTo: { not: null },
      delayNotifiedAt: null,
    },
    select: { id: true, ref: true, status: true, estimatedFrom: true, estimatedTo: true, estimatedWindow: true },
    take: 200,
  });
  const late = candidates.filter((o) => {
    if (o.status === "SHIPPED") {
      return now > estimateDeadline(o.estimatedTo!.toISOString().slice(0, 10), parseWindow(o.estimatedWindow));
    }
    // The first promised day, from midnight in Tunis (UTC+1).
    const dayStarts = new Date(o.estimatedFrom!.getTime() - 60 * 60 * 1000);
    return now >= dayStarts;
  });

  const told: string[] = [];
  for (const o of late) {
    const claimed = await prisma.order.updateMany({ where: { id: o.id, delayNotifiedAt: null }, data: { delayNotifiedAt: now } });
    if (claimed.count !== 1) continue;
    await pushOrderDelay(o.id);
    await textOrderDelay(o.id);
    told.push(o.ref);
  }
  if (told.length) console.info(`[delays] told ${told.length} customer(s): ${told.join(", ")}`);
  return told;
}

let lastSweep = 0;

/** The sweep, at most every ten minutes per server — for the order lists that trigger it. */
export async function sweepLateOrdersSometimes(): Promise<void> {
  if (Date.now() - lastSweep < 10 * 60 * 1000) return;
  lastSweep = Date.now();
  try {
    await sweepLateOrders();
  } catch (e) {
    console.warn("[delays] sweep failed:", e instanceof Error ? e.message : e);
  }
}
