import "server-only";
import { prisma } from "@/lib/prisma";
import { backInStockPush, orderLabel, orderStatusPush, pushLocale, type PushStatus } from "@/lib/push-copy";

/**
 * Push notifications, through Expo's push service.
 *
 * No key is needed to send: Expo accepts a message for any token its SDK
 * issued. `EXPO_ACCESS_TOKEN`, when set, is sent too — that is Expo's
 * "enhanced security" option, which makes the service refuse anyone else
 * sending to this app's phones. The phones only get tokens once the app is
 * built with an EAS project id (see the app's ARCHITECTURE).
 *
 * Best effort by design, like the order e-mails: a push that fails must never
 * stop the shop from moving an order along. Everything here catches and
 * resolves.
 */

const ENDPOINT = "https://exp.host/--/api/v2/push/send";
/** Expo's ceiling per request. */
const CHUNK = 100;

type Message = { to: string; title: string; body: string; data?: Record<string, string>; sound?: "default"; channelId?: string };

/** Sends; returns the tokens Expo accepted, and those it says no longer reach a phone. */
async function send(messages: Message[]): Promise<{ sent: Set<string>; dead: Set<string> }> {
  const dead = new Set<string>();
  const sent = new Set<string>();
  if (!messages.length || process.env.PUSH_DISABLED === "1") return { sent, dead };
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        console.warn(`push: Expo answered ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
      json.data?.forEach((ticket, j) => {
        if (ticket.status === "ok") sent.add(chunk[j].to);
        else if (ticket.details?.error === "DeviceNotRegistered") dead.add(chunk[j].to);
      });
    } catch (e) {
      console.warn("push: not sent", e instanceof Error ? e.message : e);
    }
  }
  return { sent, dead };
}

/**
 * Tell the phones that registered for this order that it moved. Called from
 * setOrderStatus, the one path every status change takes.
 */
export async function pushOrderStatus(orderId: string, status: PushStatus): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        ref: true,
        deliveryMethod: true,
        pushTokens: { select: { token: true, locale: true } },
        items: { orderBy: { id: "asc" }, select: { name: true } },
      },
    });
    if (!order || !order.pushTokens.length) return;
    const label = orderLabel(order.items[0]?.name ?? order.ref, Math.max(0, order.items.length - 1));
    const messages = order.pushTokens.flatMap((t) => {
      const copy = orderStatusPush(status, pushLocale(t.locale), label, order.deliveryMethod);
      return copy ? [{ to: t.token, ...copy, sound: "default" as const, channelId: "orders", data: { ref: order.ref } }] : [];
    });
    const { dead } = await send(messages);
    if (dead.size) await prisma.orderPushToken.deleteMany({ where: { token: { in: [...dead] } } });
  } catch (e) {
    console.warn("push: order status", e instanceof Error ? e.message : e);
  }
}

/**
 * Parts back on the shelf: every alert waiting on one is sent once, then
 * marked. Called after anything that can raise stock — an adjustment, an
 * inventory count, the product form, an import. With no ids, sweeps every
 * waiting alert (the import's case, where many parts change at once).
 */
export async function notifyBackInStock(productIds?: string[]): Promise<void> {
  try {
    const alerts = await prisma.stockAlert.findMany({
      where: {
        notifiedAt: null,
        ...(productIds ? { productId: { in: productIds } } : {}),
        product: { active: true, stockQty: { gt: 0 } },
      },
      select: { id: true, token: true, locale: true, product: { select: { name: true, slug: true } } },
      take: 1000,
    });
    if (!alerts.length) return;
    const { sent, dead } = await send(
      alerts.map((a) => ({
        to: a.token,
        ...backInStockPush(pushLocale(a.locale), a.product.name),
        sound: "default" as const,
        channelId: "stock",
        data: { slug: a.product.slug },
      })),
    );
    // Only what Expo took is marked: an alert that did not go out (Expo
    // unreachable) waits for the next time stock moves.
    const done = alerts.filter((a) => sent.has(a.token)).map((a) => a.id);
    if (done.length) await prisma.stockAlert.updateMany({ where: { id: { in: done } }, data: { notifiedAt: new Date() } });
    if (dead.size) {
      await prisma.stockAlert.deleteMany({ where: { token: { in: [...dead] } } });
      await prisma.orderPushToken.deleteMany({ where: { token: { in: [...dead] } } });
    }
  } catch (e) {
    console.warn("push: back in stock", e instanceof Error ? e.message : e);
  }
}
