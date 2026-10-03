import "server-only";
import { prisma } from "@/lib/prisma";
import { backInStockPush, orderLabel, orderStatusPush, pushLocale, questionReplyPush, returnStatusPush, type PushStatus, type ReturnPushStatus } from "@/lib/push-copy";

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

type Phone = { token: string; locale: string | null };

/** One message per phone: the same phone can follow an order AND be signed in to its account. */
function unique(phones: Phone[]): Phone[] {
  const seen = new Map<string, Phone>();
  for (const p of phones) if (!seen.has(p.token)) seen.set(p.token, p);
  return [...seen.values()];
}

/** The phones signed in to an account that allowed notifications. */
async function accountPhones(userId: string | null): Promise<Phone[]> {
  if (!userId) return [];
  const sessions = await prisma.customerSession.findMany({
    where: { userId, pushToken: { not: null }, expiresAt: { gt: new Date() } },
    select: { pushToken: true, pushLocale: true },
  });
  return sessions.map((s) => ({ token: s.pushToken!, locale: s.pushLocale }));
}

/**
 * Who hears about an order: the phones that asked to follow it, and every
 * phone signed in to the account that placed it — a signed-in customer does
 * not switch notifications on order by order.
 */
async function orderPhones(order: { userId: string | null; pushTokens: Phone[] }): Promise<Phone[]> {
  return unique([...order.pushTokens, ...(await accountPhones(order.userId))]);
}

/** Tokens Expo says no longer reach a phone are forgotten everywhere they are kept. */
async function forget(dead: Set<string>) {
  if (!dead.size) return;
  const tokens = [...dead];
  await Promise.all([
    prisma.orderPushToken.deleteMany({ where: { token: { in: tokens } } }),
    prisma.customerSession.updateMany({ where: { pushToken: { in: tokens } }, data: { pushToken: null } }),
    prisma.contactMessage.updateMany({ where: { pushToken: { in: tokens } }, data: { pushToken: null } }),
  ]);
}

/**
 * Tell the phones following this order that it moved. Called from
 * setOrderStatus, the one path every status change takes.
 */
export async function pushOrderStatus(orderId: string, status: PushStatus): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        ref: true,
        userId: true,
        deliveryMethod: true,
        pushTokens: { select: { token: true, locale: true } },
        items: { orderBy: { id: "asc" }, select: { name: true } },
      },
    });
    if (!order) return;
    const phones = await orderPhones(order);
    if (!phones.length) return;
    const label = orderLabel(order.items[0]?.name ?? order.ref, Math.max(0, order.items.length - 1));
    const messages = phones.flatMap((t) => {
      const copy = orderStatusPush(status, pushLocale(t.locale), label, order.deliveryMethod);
      return copy ? [{ to: t.token, ...copy, sound: "default" as const, channelId: "orders", data: { ref: order.ref } }] : [];
    });
    const { dead } = await send(messages);
    await forget(dead);
  } catch (e) {
    console.warn("push: order status", e instanceof Error ? e.message : e);
  }
}

/**
 * The shop answered a question asked from the app. The asker's phone (when it
 * allowed notifications), and — for a question about an order or from a
 * signed-in customer — the phones following that order or that account.
 * Tapping it opens the order, or the question.
 */
export async function pushQuestionReply(messageId: string): Promise<void> {
  try {
    const m = await prisma.contactMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        reply: true,
        userId: true,
        pushToken: true,
        pushLocale: true,
        order: { select: { ref: true, userId: true, pushTokens: { select: { token: true, locale: true } } } },
      },
    });
    if (!m?.reply) return;
    const phones = unique([
      ...(m.pushToken ? [{ token: m.pushToken, locale: m.pushLocale }] : []),
      ...(m.order ? await orderPhones(m.order) : []),
      ...(m.order ? [] : await accountPhones(m.userId)),
    ]);
    if (!phones.length) return;
    const data: Record<string, string> = m.order ? { ref: m.order.ref } : { question: m.id };
    const { dead } = await send(
      phones.map((t) => ({ to: t.token, ...questionReplyPush(pushLocale(t.locale), m.reply!), sound: "default" as const, channelId: "orders", data })),
    );
    await forget(dead);
  } catch (e) {
    console.warn("push: question reply", e instanceof Error ? e.message : e);
  }
}

/**
 * Tell the phones following an order that one of its return requests moved.
 * Tapping it opens the order, where the request and the shop's answer are.
 */
export async function pushReturnStatus(returnId: string, status: ReturnPushStatus): Promise<void> {
  try {
    const request = await prisma.returnRequest.findUnique({
      where: { id: returnId },
      select: { ref: true, order: { select: { ref: true, userId: true, pushTokens: { select: { token: true, locale: true } } } } },
    });
    if (!request) return;
    const phones = await orderPhones(request.order);
    if (!phones.length) return;
    const messages = phones.map((t) => ({
      to: t.token,
      ...returnStatusPush(status, pushLocale(t.locale), request.ref),
      sound: "default" as const,
      channelId: "orders",
      data: { ref: request.order.ref },
    }));
    const { dead } = await send(messages);
    await forget(dead);
  } catch (e) {
    console.warn("push: return status", e instanceof Error ? e.message : e);
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
