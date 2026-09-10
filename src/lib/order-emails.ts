import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings, publicContact } from "@/lib/settings";
import { toNumber } from "@/lib/money";
import { sendMail } from "@/lib/email";
import {
  orderConfirmationMail,
  newOrderAlertMail,
  orderStatusMail,
  type OrderForEmail,
  type ShopForEmail,
} from "@/lib/email-templates";

/**
 * The bridge between "an order changed" and "somebody was told".
 *
 * Both entry points here are **best-effort and never throw**. An order that is
 * already in the database with its stock claimed must not be undone, nor its
 * confirmation page withheld, because a mail server was slow or a key was
 * wrong. Everything is caught, logged with the reference so it can be traced,
 * and swallowed.
 *
 * The order is re-read from the database rather than passed in from the
 * checkout's own variables. It costs one query on a path that has just done a
 * transaction, and it buys certainty that the email says what was actually
 * stored — a customer's written record of the order disagreeing with the
 * order is a support call at best.
 */

/** The shop as it signs its messages, from settings. Shared with the
 *  password-reset mail so every message the shop sends has the same footer. */
export async function loadShopForEmail(): Promise<ShopForEmail> {
  return shopFor();
}

async function shopFor(): Promise<ShopForEmail> {
  const settings = await getSettings();
  const contact = publicContact(settings);
  return {
    name: contact.name,
    // publicContact returns null for anything the owner has not filled in, so
    // a placeholder can never end up as a recipient or in a signature.
    email: contact.email,
    phone: contact.phone,
    address: contact.address,
    hours: contact.hours,
    deliveryGrandTunis: settings.delivery_grand_tunis,
    deliveryRegions: settings.delivery_regions,
  };
}

async function loadOrder(orderId: string): Promise<OrderForEmail | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      ref: true,
      userId: true,
      createdAt: true,
      customerName: true,
      phone: true,
      email: true,
      address: true,
      governorate: true,
      deliveryMethod: true,
      paymentMethod: true,
      subtotal: true,
      shippingFee: true,
      total: true,
      notes: true,
      items: { select: { name: true, sku: true, imageUrl: true, qty: true, unitPrice: true, lineTotal: true } },
    },
  });
  if (!order) return null;

  return {
    ...order,
    subtotal: toNumber(order.subtotal),
    shippingFee: toNumber(order.shippingFee),
    total: toNumber(order.total),
    items: order.items.map((i) => ({
      ...i,
      unitPrice: toNumber(i.unitPrice),
      lineTotal: toNumber(i.lineTotal),
    })),
  };
}

/** Confirmation to the customer, alert to the shop. Either may be skipped:
 *  a guest can check out without an email, and the shop's own address is not
 *  filled in until somebody sets it in /admin/parametres. */
export async function notifyOrderPlaced(orderId: string): Promise<void> {
  try {
    const [order, shop] = await Promise.all([loadOrder(orderId), shopFor()]);
    if (!order) return;

    const mails = [orderConfirmationMail(order, shop), newOrderAlertMail(order, shop)].filter(
      (m) => m !== null
    );
    // In parallel, and settled rather than raced: the shop's alert must still
    // go out when the customer's address bounces, and vice versa.
    await Promise.allSettled(mails.map((m) => sendMail(m!)));
  } catch (e) {
    console.error(`[email] order ${orderId}: could not send placement mail —`, e);
  }
}

/** A message to the customer when the order moves, restating what it holds.
 *  Silent for PENDING (the confirmation already said it) and for an order
 *  with no email on it. The whole order is loaded, not just the reference:
 *  the message shows the progress strip and the lines, so a customer with
 *  three orders open knows which one moved without opening anything. */
export async function notifyOrderStatus(orderId: string, status: string): Promise<void> {
  try {
    const [order, shop] = await Promise.all([loadOrder(orderId), shopFor()]);
    if (!order) return;

    const mail = orderStatusMail(order, status, shop);
    if (mail) await sendMail(mail);
  } catch (e) {
    console.error(`[email] order ${orderId}: could not send status mail —`, e);
  }
}
