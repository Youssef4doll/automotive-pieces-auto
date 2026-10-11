import "server-only";
import { prisma } from "@/lib/prisma";
import { formatTND, toNumber } from "@/lib/money";
import { storedEstimate } from "@/lib/order-estimate";
import { orderDelayText, orderStatusText, type TextOrder, type TextStatus } from "@/lib/order-texts-copy";
import { e164 } from "@/lib/phone-code";
import { getSettings } from "@/lib/settings";
import { sendSms, smsAvailable } from "@/lib/sms";

/**
 * A text message to the customer at each step of an order, and when it will
 * be late (the owner, October 2026). The copy is lib/order-texts-copy.
 *
 * Only when an SMS provider is set up (lib/sms) and the owner has not turned
 * them off (`sms_order_updates`, /admin/parametres). Best-effort, like the
 * e-mails and the push notifications beside it: a provider outage never
 * stops an order from moving, and never answers anybody with an error.
 */
async function load(orderId: string): Promise<(TextOrder & { phone: string | null; shipped: boolean }) | null> {
  const [order, settings] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        ref: true,
        phone: true,
        total: true,
        status: true,
        deliveryMethod: true,
        estimatedFrom: true,
        estimatedTo: true,
        estimatedWindow: true,
      },
    }),
    getSettings(),
  ]);
  if (!order || settings.sms_order_updates.trim() === "0" || !smsAvailable()) return null;
  return {
    shop: settings.shop_name,
    ref: order.ref,
    total: formatTND(toNumber(order.total)),
    deliveryMethod: order.deliveryMethod,
    estimate: storedEstimate(order),
    phone: e164(order.phone),
    shipped: order.status === "SHIPPED",
  };
}

export async function textOrderStatus(orderId: string, status: TextStatus): Promise<void> {
  try {
    const o = await load(orderId);
    const body = o && orderStatusText(status, o);
    if (o?.phone && body) await sendSms(o.phone, body);
  } catch (e) {
    console.warn("sms: order status", e instanceof Error ? e.message : e);
  }
}

export async function textOrderDelay(orderId: string): Promise<void> {
  try {
    const o = await load(orderId);
    if (o?.phone) await sendSms(o.phone, orderDelayText(o));
  } catch (e) {
    console.warn("sms: order delay", e instanceof Error ? e.message : e);
  }
}
