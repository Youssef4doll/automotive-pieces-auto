import "server-only";
import { formatTNDfr } from "@/lib/money";
import { siteUrl } from "@/lib/site";
import type { Mail } from "@/lib/email";

/**
 * What the shop actually writes to people.
 *
 * Three messages, and the same house rules the storefront follows apply here
 * with more force, because an email is kept, forwarded and re-read long after
 * the page it came from has changed:
 *
 *  - Never state a delivery date. The shop quotes a window ("24h Grand Tunis,
 *    48–72h régions") and that is what goes in, exactly as the settings say
 *    it. A specific date nobody committed to is a promise the shop has to
 *    keep, in writing.
 *  - Never invent a tracking number, a courier, or a payment status.
 *  - Say what the customer actually bought, at the prices actually charged —
 *    the snapshot on the order, not today's catalogue price.
 *
 * Written as tables with inline styles because that is what mail clients
 * render: Outlook has no flexbox, Gmail strips <style> blocks, and a layout
 * that relies on either arrives as a stack of unstyled text.
 */

const NAVY = "#0f2352";
const INK = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";

export type OrderForEmail = {
  ref: string;
  customerName: string;
  phone: string;
  email: string | null;
  /** Null for a pickup order, and optional on the form. */
  address: string | null;
  governorate: string;
  deliveryMethod: "DELIVERY" | "PICKUP";
  paymentMethod: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  notes: string | null;
  items: { name: string; sku: string; qty: number; unitPrice: number; lineTotal: number }[];
};

export type ShopForEmail = {
  name: string;
  /** Null when the owner has not filled it in — never printed as a placeholder. */
  email: string | null;
  phone: string | null;
  deliveryGrandTunis: string;
  deliveryRegions: string;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shell(title: string, shopName: string, body: string, footer?: string) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:${INK};">
  <tr><td style="background:${NAVY};padding:18px 24px;">
    <span style="color:#ffffff;font-size:16px;font-weight:bold;letter-spacing:.4px;">${esc(shopName)}</span>
  </td></tr>
  <tr><td style="padding:24px;">${body}</td></tr>
  ${footer ? `<tr><td style="padding:0 24px 24px;border-top:1px solid ${LINE};"><p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${MUTED};">${footer}</p></td></tr>` : ""}
</table>
</td></tr></table>
</body></html>`;
}

function itemRows(order: OrderForEmail) {
  return order.items
    .map(
      (i) => `<tr>
  <td style="padding:8px 0;border-bottom:1px solid ${LINE};font-size:14px;">
    ${esc(i.name)}<br><span style="color:${MUTED};font-size:12px;">${esc(i.sku)} · ×${i.qty}</span>
  </td>
  <td style="padding:8px 0;border-bottom:1px solid ${LINE};font-size:14px;text-align:right;white-space:nowrap;">
    ${esc(formatTNDfr(i.lineTotal))}
  </td>
</tr>`
    )
    .join("");
}

function totals(order: OrderForEmail) {
  const shipping =
    order.shippingFee > 0 ? esc(formatTNDfr(order.shippingFee)) : "Offerte";
  return `<tr><td style="padding:8px 0;font-size:14px;color:${MUTED};">Sous-total</td>
  <td style="padding:8px 0;font-size:14px;text-align:right;">${esc(formatTNDfr(order.subtotal))}</td></tr>
<tr><td style="padding:0 0 8px;font-size:14px;color:${MUTED};">${order.deliveryMethod === "PICKUP" ? "Retrait en magasin" : "Livraison"}</td>
  <td style="padding:0 0 8px;font-size:14px;text-align:right;">${shipping}</td></tr>
<tr><td style="padding:12px 0 0;border-top:2px solid ${NAVY};font-size:15px;font-weight:bold;">Total</td>
  <td style="padding:12px 0 0;border-top:2px solid ${NAVY};font-size:15px;font-weight:bold;text-align:right;">${esc(formatTNDfr(order.total))}</td></tr>`;
}

/** The delivery promise, quoted from settings — never a date. */
function deliveryLine(order: OrderForEmail, shop: ShopForEmail) {
  if (order.deliveryMethod === "PICKUP") return "À retirer en magasin. Nous vous prévenons dès qu'elle est prête.";
  return `Livraison estimée : ${esc(shop.deliveryGrandTunis)} sur le Grand Tunis, ${esc(shop.deliveryRegions)} en régions.`;
}

/* ------------------------------------------------ to the customer -------- */

export function orderConfirmationMail(order: OrderForEmail, shop: ShopForEmail): Mail | null {
  // No address, no message. Guest checkout does not require an email, and the
  // shop has the phone number for those.
  if (!order.email) return null;

  const url = `${siteUrl()}/compte/commandes/${order.ref}`;
  const body = `
<h1 style="margin:0 0 4px;font-size:20px;color:${NAVY};">Commande confirmée</h1>
<p style="margin:0 0 16px;font-size:14px;color:${MUTED};">
  Merci ${esc(order.customerName)} — nous préparons votre commande.
</p>
<p style="margin:0 0 20px;font-size:14px;">
  Référence : <strong style="font-family:monospace;">${esc(order.ref)}</strong>
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(order)}${totals(order)}</table>
<p style="margin:20px 0 0;font-size:14px;line-height:1.6;">${deliveryLine(order, shop)}</p>
<p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">
  ${order.paymentMethod === "COD" ? "Paiement à la livraison, en espèces." : "Paiement : " + esc(order.paymentMethod)}
</p>
<p style="margin:24px 0 0;">
  <a href="${esc(url)}" style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:bold;">Suivre ma commande</a>
</p>`;

  const contact = [shop.phone && `téléphone ${shop.phone}`, shop.email].filter(Boolean).join(" · ");
  const footer = contact
    ? `Une question sur cette commande ? Répondez à cet e-mail ou contactez-nous : ${esc(contact)}.`
    : "Une question sur cette commande ? Répondez simplement à cet e-mail.";

  const text = [
    `Commande confirmée — ${order.ref}`,
    ``,
    `Merci ${order.customerName}, nous préparons votre commande.`,
    ``,
    ...order.items.map((i) => `- ${i.name} (${i.sku}) x${i.qty} — ${formatTNDfr(i.lineTotal)}`),
    ``,
    `Sous-total : ${formatTNDfr(order.subtotal)}`,
    `${order.deliveryMethod === "PICKUP" ? "Retrait en magasin" : "Livraison"} : ${order.shippingFee > 0 ? formatTNDfr(order.shippingFee) : "offerte"}`,
    `Total : ${formatTNDfr(order.total)}`,
    ``,
    order.deliveryMethod === "PICKUP"
      ? "À retirer en magasin. Nous vous prévenons dès qu'elle est prête."
      : `Livraison estimée : ${shop.deliveryGrandTunis} sur le Grand Tunis, ${shop.deliveryRegions} en régions.`,
    ``,
    `Suivre ma commande : ${url}`,
  ].join("\n");

  return {
    to: order.email,
    subject: `Commande ${order.ref} confirmée — ${shop.name}`,
    html: shell(`Commande ${order.ref}`, shop.name, body, footer),
    text,
    replyTo: shop.email ?? undefined,
  };
}

/* ---------------------------------------------------- to the shop -------- */

export function newOrderAlertMail(order: OrderForEmail, shop: ShopForEmail): Mail | null {
  // Nowhere to send it until the owner fills in the shop address in
  // /admin/parametres. Silence beats mailing a placeholder.
  if (!shop.email) return null;

  const where =
    order.deliveryMethod === "PICKUP"
      ? "Retrait en magasin"
      : `${order.address ? esc(order.address) + ", " : ""}${esc(order.governorate)}`;

  const body = `
<h1 style="margin:0 0 4px;font-size:20px;color:${NAVY};">Nouvelle commande — ${esc(order.ref)}</h1>
<p style="margin:0 0 20px;font-size:14px;color:${MUTED};">${esc(order.customerName)} · ${esc(order.phone)}${order.email ? " · " + esc(order.email) : ""}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(order)}${totals(order)}</table>
<p style="margin:20px 0 0;font-size:14px;line-height:1.6;"><strong>Livraison :</strong> ${where}</p>
${order.notes ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.6;"><strong>Note du client :</strong> ${esc(order.notes)}</p>` : ""}
<p style="margin:24px 0 0;">
  <a href="${esc(siteUrl())}/admin/commandes" style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:bold;">Ouvrir dans l'admin</a>
</p>`;

  const text = [
    `Nouvelle commande ${order.ref}`,
    `${order.customerName} · ${order.phone}${order.email ? " · " + order.email : ""}`,
    ``,
    ...order.items.map((i) => `- ${i.name} (${i.sku}) x${i.qty} — ${formatTNDfr(i.lineTotal)}`),
    ``,
    `Total : ${formatTNDfr(order.total)}`,
    `Livraison : ${order.deliveryMethod === "PICKUP" ? "Retrait en magasin" : [order.address, order.governorate].filter(Boolean).join(", ")}`,
    order.notes ? `Note : ${order.notes}` : "",
    ``,
    `${siteUrl()}/admin/commandes`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    to: shop.email,
    subject: `Nouvelle commande ${order.ref} — ${formatTNDfr(order.total)}`,
    html: shell(`Nouvelle commande ${order.ref}`, shop.name, body),
    text,
    // So the shop can reply straight to the customer from its inbox.
    replyTo: order.email ?? undefined,
  };
}

/* ------------------------------------------ status moved on -------------- */

/** What each status means to the person waiting, in the shop's own words.
 *  PENDING is absent on purpose: it is the state the confirmation email
 *  already covers, and a second message saying the same thing is noise. */
const STATUS_COPY: Record<string, { subject: string; line: string }> = {
  CONFIRMED: { subject: "confirmée", line: "Votre commande est confirmée et part en préparation." },
  PREPARED: { subject: "préparée", line: "Votre commande est prête et part à la livraison." },
  SHIPPED: { subject: "expédiée", line: "Votre commande est en route." },
  DELIVERED: { subject: "livrée", line: "Votre commande a été livrée. Merci de votre confiance." },
  CANCELLED: { subject: "annulée", line: "Votre commande a été annulée." },
};

export function orderStatusMail(
  order: Pick<OrderForEmail, "ref" | "customerName" | "email">,
  status: string,
  shop: ShopForEmail
): Mail | null {
  const copy = STATUS_COPY[status];
  if (!copy || !order.email) return null;

  const url = `${siteUrl()}/compte/commandes/${order.ref}`;
  const body = `
<h1 style="margin:0 0 4px;font-size:20px;color:${NAVY};">Commande ${esc(copy.subject)}</h1>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${esc(copy.line)}</p>
<p style="margin:0 0 24px;font-size:14px;">Référence : <strong style="font-family:monospace;">${esc(order.ref)}</strong></p>
<p style="margin:0;">
  <a href="${esc(url)}" style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:bold;">Voir ma commande</a>
</p>`;

  return {
    to: order.email,
    subject: `Commande ${order.ref} ${copy.subject} — ${shop.name}`,
    html: shell(`Commande ${order.ref}`, shop.name, body),
    text: `${copy.line}\n\nRéférence : ${order.ref}\n${url}`,
    replyTo: shop.email ?? undefined,
  };
}
