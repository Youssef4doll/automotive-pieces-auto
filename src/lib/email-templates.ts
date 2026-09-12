import "server-only";
import { formatTNDfr } from "@/lib/money";
import { taxBreakdown, vatRateLabel } from "@/lib/tax";
import { siteUrl } from "@/lib/site";
import { GRAND_TUNIS } from "@/lib/governorates";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABEL } from "@/lib/order-status";
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
 *    it, narrowed to the customer's own governorate. A specific date nobody
 *    committed to is a promise the shop has to keep, in writing.
 *  - Never invent a tracking number, a courier, or a payment status. The
 *    progress strip shows the steps an order goes through and which one this
 *    order is on — it puts no time against a step that has not happened.
 *  - Say what the customer actually bought, at the prices actually charged —
 *    the snapshot on the order, not today's catalogue price. A line's photo is
 *    shown only when it is the part's own photo; the catalogue's placeholder
 *    artwork is not presented as a picture of what was ordered.
 *
 * Written as nested tables with inline styles because that is what mail
 * clients render: Outlook has no flexbox, none of them have <svg>, and a
 * layout that relies on either arrives as a stack of unstyled text. The icons
 * are therefore either type — a check mark, a step number — in a coloured
 * cell, or a PNG.
 *
 * The one <style> block is progressive enhancement, never load-bearing. It
 * carries the phone rules: a row of three table cells at 33% each does not
 * become three readable columns at 360px, it becomes three columns of one
 * word per line, so every such row is marked and stacks under 620px. Gmail,
 * Apple Mail, iOS Mail, Outlook.com and Yahoo honour it; Outlook on Windows
 * ignores it and renders the desktop width, which is what it has anyway.
 * Nothing is hidden or positioned by it — strip the block and every message
 * is still correct, just narrower on a phone.
 *
 * The webfont <link> is the same bargain: Apple Mail and iOS load Barlow and
 * Archivo so the message is set in the site's own faces, Gmail drops it and
 * everything lands on Arial. Each stack ends in Arial for that reason.
 *
 * The pictures come from /public/images/email/, cut down to email size from
 * the site's own artwork (a 6 KB logo, a 58 KB hero, 3–4 KB icons) rather
 * than the 0.5–1.7 MB originals the pages get through next/image. A mail
 * client fetches the file as-is.
 */

const NAVY = "#0f2352";
const NAVY_DEEP = "#081633";
const GOLD = "#fbc000";
const RED = "#e1112c";
const GREEN = "#16a34a";
const INK = "#1f2937";
const BODY = "#4b5563";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";
const LINE = "#e5e7eb";
const PALE = "#eef3fb";
const CANVAS = "#f1f3f7";

/**
 * The shop's own three faces, each with a real fallback.
 *
 * Apple Mail and iOS Mail honour the webfont link in the head, so on a
 * Tunisian customer's iPhone the message is set in the same Barlow/Archivo
 * the site uses. Gmail strips it and everything lands on Arial, which is why
 * every stack ends there rather than in something exotic — a message must be
 * designed to be right in Arial and better in Barlow, never the other way
 * round.
 */
const FONT = "'Barlow',Arial,Helvetica,'Segoe UI',sans-serif";
const FONT_HEAD = "'Archivo','Barlow',Arial,Helvetica,sans-serif";
const FONT_DISPLAY = "'Barlow Condensed','Barlow',Arial,Helvetica,sans-serif";

export type OrderForEmail = {
  id: string;
  ref: string;
  /** Set when the order belongs to an account; a guest order has none. */
  userId: string | null;
  createdAt: Date;
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
  /** The shop's tax position as snapshotted on this order — see lib/tax. */
  vatRate: number;
  stampDuty: number;
  total: number;
  notes: string | null;
  items: {
    name: string;
    sku: string;
    /** The snapshot taken at checkout. Only a `/api/images/…` value is a real photo of the part. */
    imageUrl: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }[];
};

export type ShopForEmail = {
  name: string;
  /** Null when the owner has not filled it in — never printed as a placeholder. */
  email: string | null;
  phone: string | null;
  address: string | null;
  hours: string | null;
  deliveryGrandTunis: string;
  deliveryRegions: string;
};

/* ------------------------------------------------------------ helpers ---- */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "12 sept. 2026 · 14:32", in the shop's own time zone whatever the server's is. */
function fmtWhen(d: Date) {
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Tunis" });
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" });
  return `${day.format(d)} · ${time.format(d)}`;
}

/**
 * Where "voir ma commande" goes. An account holder has a page for it; a guest
 * has the confirmation page, which recognises the browser the order was placed
 * in. Sending a guest to /compte/commandes would land them on a sign-in form
 * and then a 404, since the order is not attached to any account.
 */
function orderUrl(order: Pick<OrderForEmail, "ref" | "userId">) {
  return order.userId
    ? `${siteUrl()}/compte/commandes/${order.ref}`
    : `${siteUrl()}/commande/confirmation/${order.ref}`;
}

/** The delivery promise, quoted from settings for the customer's own region — never a date. */
function deliveryWindow(order: OrderForEmail, shop: ShopForEmail): string | null {
  if (order.deliveryMethod === "PICKUP") return null;
  return GRAND_TUNIS.has(order.governorate)
    ? `${shop.deliveryGrandTunis} (Grand Tunis)`
    : `${shop.deliveryRegions} (régions)`;
}

function paymentLabel(method: string) {
  return method === "COD" ? "À la livraison, en espèces" : method === "CARD" ? "Carte bancaire" : method;
}

function deliveryLabel(order: OrderForEmail) {
  if (order.deliveryMethod === "PICKUP") return "Retrait en magasin";
  return [order.address, order.governorate]
    .filter((s): s is string => !!s)
    .map(esc)
    .join(", ");
}

/* ------------------------------------------------------------- blocks ---- */

function row(inner: string, style = "") {
  return `<tr><td class="p" style="${style}">${inner}</td></tr>`;
}

function logo(width: number) {
  const height = Math.round(width / 3);
  return `<img src="${siteUrl()}/images/email/logo-white.png" width="${width}" height="${height}" alt="Automotive Pièces Auto" style="display:block;width:${width}px;height:${height}px;border:0;">`;
}

/**
 * The frame every message sits in: navy header with the logo, white body, navy
 * footer with the shop's real details. `preheader` is the line inbox lists
 * show under the subject; without one they show the first words of the body.
 */
function shell(opts: { title: string; preheader: string; kicker: string; shop: ShopForEmail; body: string; reason?: string }) {
  const { title, preheader, kicker, shop, body } = opts;
  // Why this landed in their inbox — the line under the card. An order's
  // messages say an order; anything else must say what it actually was.
  const reason = opts.reason ?? "qu'une commande a été passée sur %HOST% avec cette adresse";
  const contact = [shop.phone, shop.email].filter(Boolean).map((s) => esc(s!)).join(" &nbsp;·&nbsp; ");
  const place = [shop.address, shop.hours].filter(Boolean).map((s) => esc(s!)).join(" &nbsp;·&nbsp; ");
  const host = siteUrl().replace(/^https?:\/\//, "");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;800&family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@700&display=swap" rel="stylesheet">
<style>
  /* A phone is where most of these are opened, and a row of three table
     cells at 33% each does not become three readable columns at 360px — it
     becomes three columns of one word per line. Every such row carries
     .sm-col, and here each cell becomes a full-width block, so the row
     stacks. Gmail, Apple Mail, iOS Mail, Outlook.com and Yahoo all honour
     this; Outlook on Windows ignores it and renders the desktop width, which
     is what it has anyway.

     !important throughout because these override inline styles, which is the
     only way anything in an email can. */
  @media only screen and (max-width:620px) {
    td.p { padding-left:20px !important; padding-right:20px !important; }
    td.sm-col { display:block !important; width:100% !important; max-width:100% !important;
                padding:0 0 14px 0 !important; border-left:0 !important; text-align:left !important; }
    td.sm-col:last-child { padding-bottom:0 !important; }
    td.sm-hide { display:none !important; }
    td.sm-stack { display:block !important; width:100% !important; text-align:left !important; padding:6px 0 0 0 !important; }
    .sm-h1 { font-size:23px !important; line-height:1.2 !important; }
    .sm-step { font-size:10px !important; }
    .sm-hero { padding:22px 20px !important; }
  }
</style></head>
<body style="margin:0;padding:0;background:${CANVAS};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:${FONT};color:${INK};">
  <tr><td style="background:${NAVY};padding:18px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="left" valign="middle">${logo(124)}</td>
      <td align="right" valign="middle" style="font-family:${FONT_DISPLAY};font-size:14px;line-height:1.4;letter-spacing:1px;text-transform:uppercase;color:#c7d0e3;">${esc(kicker)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:${GOLD};height:3px;line-height:3px;font-size:3px;">&nbsp;</td></tr>
  ${body}
  <tr><td style="background:${NAVY_DEEP};padding:22px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td class="sm-col" align="left" valign="middle">${logo(96)}</td>
      <td class="sm-col" align="right" valign="middle" style="font-family:${FONT};font-size:13px;line-height:1.7;color:#c7d0e3;">
        <span style="color:${GOLD};">&#8212;</span>&nbsp; <span style="color:#ffffff;">Votre véhicule mérite le meilleur</span>
        ${contact ? `<br>${contact}` : ""}${place ? `<br><span style="color:#8f9bb8;">${place}</span>` : ""}
      </td>
    </tr></table>
  </td></tr>
</table>
<p style="max-width:600px;margin:14px auto 0;font-family:${FONT};font-size:11px;line-height:1.6;color:${FAINT};text-align:center;">
  Vous recevez cet e-mail parce ${reason.replace("%HOST%", esc(host))}.
  Pour toute question, répondez simplement à ce message.
</p>
</td></tr></table>
</body></html>`;
}

/** Big check mark, headline, one line under it — on the pale band. */
function hero(opts: { headline: string; sub: string; tone?: "green" | "navy" | "red"; picture?: boolean; glyph?: string }) {
  const tone = opts.tone ?? "green";
  const badge = tone === "green" ? GREEN : tone === "red" ? RED : NAVY;
  const glyph = opts.glyph ?? (tone === "red" ? "&#10005;" : "&#10003;");
  return `
<tr><td class="sm-hero" style="background:${PALE};padding:28px 28px ${opts.picture ? "0" : "26px"};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="46" valign="top">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="46" height="46" align="center" valign="middle" style="width:46px;height:46px;border-radius:23px;background:${badge};color:#ffffff;font-family:${FONT};font-size:22px;font-weight:bold;line-height:46px;">${glyph}</td>
      </tr></table>
    </td>
    <td valign="top" style="padding-left:16px;">
      <h1 class="sm-h1" style="margin:0 0 6px;font-family:${FONT_HEAD};font-size:27px;line-height:1.12;font-weight:800;letter-spacing:-.3px;color:${NAVY};">${opts.headline}</h1>
      <p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY};">${opts.sub}</p>
    </td>
  </tr></table>
</td></tr>
${
  opts.picture
    ? `<tr><td class="sm-hero" style="background:${PALE};padding:14px 28px 0;line-height:0;font-size:0;">
  <img src="${siteUrl()}/images/email/hero-lineup.jpg" width="544" alt="" style="display:block;width:100%;max-width:544px;height:auto;border:0;">
</td></tr>`
    : ""
}`;
}

/** "Numéro de commande" and "Date de commande", side by side. Both are facts on the order. */
function refAndDate(order: OrderForEmail) {
  const card = (label: string, value: string) => `
    <td class="sm-col" width="48%" valign="top" style="border:1px solid ${LINE};border-radius:10px;padding:12px 14px;">
      <span style="font-family:${FONT_DISPLAY};font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">${label}</span><br>
      <span style="font-family:${FONT_HEAD};font-size:18px;line-height:1.5;font-weight:800;color:${NAVY};">${value}</span>
    </td>`;
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${card("Numéro de commande", esc(order.ref))}<td class="sm-hide" width="4%"></td>${card("Date de commande", esc(fmtWhen(order.createdAt)))}
    </tr></table>`,
    "padding:22px 28px 0;"
  );
}

function button(label: string, href: string, scheme: "gold" | "navy" = "gold") {
  const bg = scheme === "gold" ? GOLD : NAVY;
  const fg = scheme === "gold" ? NAVY_DEEP : "#ffffff";
  return row(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background:${bg};border-radius:8px;">
        <a href="${esc(href)}" style="display:inline-block;padding:14px 24px;font-family:${FONT_DISPLAY};font-size:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${fg};text-decoration:none;">${label} &rarr;</a>
      </td>
    </tr></table>`,
    "padding:18px 28px 0;"
  );
}

/** Step label for the customer: the storefront's own words, except that the
 *  first state is "Reçue" here — "En attente" is the shop's view of it. */
const STEP_LABEL: Record<string, string> = { ...ORDER_STATUS_LABEL, PENDING: "Reçue" };

/**
 * Where the order is, out of the steps it goes through. Reached steps are green,
 * the current one navy, the rest grey with their number. No step carries a time
 * — the only time in this email is the one the order was actually placed at.
 */
function progress(status: string) {
  const at = ORDER_STATUS_FLOW.indexOf(status as (typeof ORDER_STATUS_FLOW)[number]);
  if (at < 0) return "";
  const last = ORDER_STATUS_FLOW.length - 1;
  // The connector between two circles is green once the later of the two has
  // been reached. Drawn as a 2px cell either side of each circle, so the
  // strip is one table row and needs no absolute positioning, which mail
  // clients do not have.
  const connector = (on: boolean, hidden: boolean) =>
    `<td valign="top" style="padding-top:14px;"><div style="height:2px;line-height:2px;font-size:2px;background:${hidden ? "transparent" : on ? GREEN : LINE};">&nbsp;</div></td>`;
  const cells = ORDER_STATUS_FLOW.map((s, i) => {
    const done = i < at;
    const now = i === at;
    const bg = done ? GREEN : now ? NAVY : "#ffffff";
    const fg = done || now ? "#ffffff" : FAINT;
    const border = done || now ? bg : LINE;
    const glyph = done || now ? "&#10003;" : String(i + 1);
    return `<td width="20%" align="center" valign="top">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        ${connector(i <= at && i > 0, i === 0)}
        <td width="30" align="center" valign="top">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="30" height="30" align="center" valign="middle" style="width:30px;height:30px;border-radius:15px;background:${bg};border:1px solid ${border};color:${fg};font-family:${FONT};font-size:13px;font-weight:bold;line-height:30px;">${glyph}</td>
          </tr></table>
        </td>
        ${connector(i < at, i === last)}
      </tr></table>
      <div class="sm-step" style="margin-top:8px;padding:0 2px;font-family:${FONT};font-size:12px;line-height:1.3;color:${now ? NAVY : done ? INK : FAINT};font-weight:${now || done ? "bold" : "normal"};">${esc(STEP_LABEL[s])}</div>
    </td>`;
  }).join("");
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:12px;"><tr><td style="padding:18px 8px 14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>
      <p style="margin:14px 6px 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};text-align:center;">Nous vous écrivons à chaque étape.</p>
    </td></tr></table>`,
    "padding:24px 28px 0;"
  );
}

/** One of the small line icons in /public/images/email, on a pale disc. */
function icon(name: "truck" | "cash" | "headset" | "shield", size = 44) {
  const img = Math.round(size * 0.55);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="${size}" height="${size}" align="center" valign="middle" style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:${PALE};">
      <img src="${siteUrl()}/images/email/icon-${name}.png" width="${img}" height="${img}" alt="" style="display:block;width:${img}px;height:${img}px;border:0;">
    </td>
  </tr></table>`;
}

/** The pale note under the lines: what happens next, and where to look meanwhile. */
function nextStepsNote(order: OrderForEmail) {
  const meanwhile = order.userId
    ? "En attendant, vous pouvez suivre son évolution depuis votre espace client."
    : "En attendant, conservez cet e-mail : il tient lieu de récapitulatif de commande.";
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PALE};border-radius:10px;"><tr>
      <td width="44" valign="middle" style="padding:14px 0 14px 16px;">${icon("truck", 40)}</td>
      <td valign="middle" style="padding:14px 16px 14px 12px;font-family:${FONT};font-size:14px;line-height:1.6;color:${BODY};">
        Vous recevrez un e-mail dès que votre commande sera expédiée.<br>${meanwhile}
      </td>
    </tr></table>`,
    "padding:22px 28px 0;"
  );
}

function sectionTitle(text: string, aside?: string, asideHref?: string) {
  const side = asideHref
    ? `<a href="${esc(asideHref)}" style="font-family:${FONT};font-size:12px;font-weight:bold;color:${NAVY};text-decoration:none;white-space:nowrap;">${aside} &rarr;</a>`
    : aside ?? "";
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font-family:${FONT_HEAD};font-size:17px;font-weight:800;letter-spacing:-.2px;color:${NAVY};">${text}</td>
      ${side ? `<td class="sm-stack" align="right" valign="middle" style="font-family:${FONT};font-size:13px;color:${MUTED};">${side}</td>` : ""}
    </tr></table>`,
    "padding:26px 28px 10px;"
  );
}

/** A photo only when it is the part's own; otherwise a quiet blank, not placeholder art. */
function thumb(item: OrderForEmail["items"][number]) {
  const photo = item.imageUrl.startsWith("/api/images/");
  return photo
    ? `<img src="${siteUrl()}${esc(item.imageUrl)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:8px;border:1px solid ${LINE};background:#ffffff;">`
    : `<div style="width:56px;height:56px;border-radius:8px;background:#f3f4f6;"></div>`;
}

function items(order: OrderForEmail) {
  const lines = order.items
    .map(
      (i) => `<tr>
    <td width="56" valign="top" style="padding:10px 0;border-top:1px solid ${LINE};">${thumb(i)}</td>
    <td valign="top" style="padding:10px 12px;border-top:1px solid ${LINE};font-family:${FONT};">
      <div style="font-size:15px;line-height:1.4;font-weight:700;color:${NAVY};">${esc(i.name)}</div>
      <div style="margin-top:3px;font-size:13px;line-height:1.4;color:${MUTED};">Réf. ${esc(i.sku)} &nbsp;·&nbsp; ${i.qty} × ${esc(formatTNDfr(i.unitPrice))}</div>
    </td>
    <td valign="top" align="right" style="padding:10px 0;border-top:1px solid ${LINE};font-family:${FONT_HEAD};font-size:15px;line-height:1.4;font-weight:800;color:${NAVY};white-space:nowrap;">${esc(formatTNDfr(i.lineTotal))}</td>
  </tr>`
    )
    .join("");
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${lines}</table>`,
    "padding:0 28px;"
  );
}

/**
 * The money, broken out the way the receipt breaks it out.
 *
 * Same function behind both (lib/tax), because an email and a printed facture
 * disagreeing about one order is the kind of thing a customer photographs and
 * sends to the shop. Untaxed — a shop with no matricule fiscal — this renders
 * the plain three lines it always did.
 */
function totals(order: OrderForEmail) {
  const tax = taxBreakdown(order);
  const shipping = order.shippingFee > 0 ? esc(formatTNDfr(tax.shippingHT)) : "Offerte";
  const line = (label: string, value: string, strong = false) => `<tr>
    <td style="padding:${strong ? "12px 0 0" : "6px 0 0"};font-family:${strong ? FONT_HEAD : FONT};font-size:${strong ? "18px" : "14px"};color:${strong ? NAVY : MUTED};font-weight:${strong ? "800" : "normal"};${strong ? `border-top:2px solid ${NAVY};` : ""}">${label}</td>
    <td align="right" style="padding:${strong ? "12px 0 0" : "6px 0 0"};font-family:${strong ? FONT_HEAD : FONT};font-size:${strong ? "18px" : "14px"};color:${strong ? NAVY : INK};font-weight:${strong ? "800" : "normal"};white-space:nowrap;${strong ? `border-top:2px solid ${NAVY};` : ""}">${value}</td>
  </tr>`;
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${LINE};">
      ${line(tax.taxed ? "Sous-total HT" : "Sous-total", esc(formatTNDfr(tax.goodsHT)))}
      ${line(
        order.deliveryMethod === "PICKUP" ? "Retrait en magasin" : tax.taxed ? "Frais de livraison HT" : "Livraison",
        order.deliveryMethod === "PICKUP" ? "—" : shipping,
      )}
      ${tax.taxed ? line(`TVA ${vatRateLabel(tax.vatRate)}`, esc(formatTNDfr(tax.vat))) : ""}
      ${tax.stampDuty > 0 ? line("Timbre fiscal", esc(formatTNDfr(tax.stampDuty))) : ""}
      ${line(tax.taxed ? "Total TTC" : "Total", esc(formatTNDfr(order.total)), true)}
    </table>`,
    "padding:8px 28px 0;"
  );
}

/** Delivery and payment, as they are on the order and in settings. */
function logistics(order: OrderForEmail, shop: ShopForEmail) {
  const window = deliveryWindow(order, shop);
  const cell = (label: string, value: string) => `
    <td class="sm-col" width="33%" valign="top" style="padding:0 8px;">
      <div style="font-family:${FONT_DISPLAY};font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">${label}</div>
      <div style="margin-top:3px;font-family:${FONT};font-size:14px;line-height:1.5;color:${INK};">${value}</div>
    </td>`;
  const first =
    order.deliveryMethod === "PICKUP"
      ? cell("Retrait", "En magasin" + (shop.address ? `<br><span style="color:${MUTED};">${esc(shop.address)}</span>` : ""))
      : cell("Livraison à", deliveryLabel(order));
  const second =
    order.deliveryMethod === "PICKUP"
      ? cell("Quand", "Nous vous prévenons dès qu'elle est prête" + (shop.hours ? `<br><span style="color:${MUTED};">${esc(shop.hours)}</span>` : ""))
      : cell("Délai indicatif", window ? esc(window) : "—");
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PALE};border-left:4px solid ${NAVY};border-radius:0 10px 10px 0;"><tr><td style="padding:14px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        ${first}${second}${cell("Paiement", esc(paymentLabel(order.paymentMethod)))}
      </tr></table>
    </td></tr></table>`,
    "padding:22px 28px 0;"
  );
}

/** Three short facts a customer wants restated, each with its icon. Only
 *  what is true for this order: the payment method it was placed with, the
 *  delivery window for its own region, the way to reach the shop that exists. */
function assurances(order: OrderForEmail, shop: ShopForEmail) {
  const window = deliveryWindow(order, shop);
  const facts: [string, string, "cash" | "truck" | "headset"][] = [
    order.paymentMethod === "COD"
      ? ["Paiement à la livraison", "Vous payez à la réception, en espèces.", "cash"]
      : ["Paiement", esc(paymentLabel(order.paymentMethod)), "cash"],
    order.deliveryMethod === "PICKUP"
      ? ["Retrait en magasin", "Nous vous prévenons dès que c'est prêt.", "truck"]
      : ["Livraison rapide", `Délai indicatif : ${esc(window ?? "—")}`, "truck"],
    shop.phone ? ["Support client", `Appelez le ${esc(shop.phone)}`, "headset"] : ["Support client", "Répondez à cet e-mail.", "headset"],
  ];
  const cells = facts
    .map(
      ([title, line, name]) => `<td class="sm-col" width="33%" valign="top" style="padding:0 6px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="top" style="padding-right:10px;">${icon(name, 40)}</td>
        <td valign="top">
          <div style="font-family:${FONT};font-size:14px;font-weight:700;color:${NAVY};line-height:1.3;">${title}</div>
          <div style="margin-top:3px;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">${line}</div>
        </td>
      </tr></table>
    </td>`
    )
    .join("");
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${LINE};"><tr><td style="padding:18px 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>
    </td></tr></table>`,
    "padding:24px 28px 0;"
  );
}

function signoff(shop: ShopForEmail) {
  return row(
    `<p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${BODY};">À très bientôt,<br><strong style="color:${NAVY};">L'équipe ${esc(shop.name)}</strong></p>`,
    "padding:26px 28px 28px;"
  );
}

function textLines(order: OrderForEmail, shop: ShopForEmail) {
  const window = deliveryWindow(order, shop);
  const tax = taxBreakdown(order);
  return [
    ...order.items.map((i) => `- ${i.name} (réf. ${i.sku}) × ${i.qty} — ${formatTNDfr(i.lineTotal)}`),
    ``,
    `${tax.taxed ? "Sous-total HT" : "Sous-total"} : ${formatTNDfr(tax.goodsHT)}`,
    order.deliveryMethod === "PICKUP"
      ? `Retrait en magasin`
      : `${tax.taxed ? "Frais de livraison HT" : "Livraison"} : ${
          order.shippingFee > 0 ? formatTNDfr(tax.shippingHT) : "offerte"
        }`,
    ...(tax.taxed ? [`TVA ${vatRateLabel(tax.vatRate)} : ${formatTNDfr(tax.vat)}`] : []),
    ...(tax.stampDuty > 0 ? [`Timbre fiscal : ${formatTNDfr(tax.stampDuty)}`] : []),
    `${tax.taxed ? "Total TTC" : "Total"} : ${formatTNDfr(order.total)}`,
    ``,
    order.deliveryMethod === "PICKUP"
      ? `Retrait en magasin — nous vous prévenons dès que la commande est prête.`
      : `Livraison à : ${[order.address, order.governorate].filter(Boolean).join(", ")}`,
    ...(window ? [`Délai indicatif : ${window}`] : []),
    `Paiement : ${paymentLabel(order.paymentMethod)}`,
  ];
}

/* ------------------------------------------------ to the customer -------- */

export function orderConfirmationMail(order: OrderForEmail, shop: ShopForEmail): Mail | null {
  // No address, no message. Guest checkout does not require an email, and the
  // shop has the phone number for those.
  if (!order.email) return null;

  const url = orderUrl(order);
  const count = order.items.reduce((n, i) => n + i.qty, 0);
  const firstName = order.customerName.trim().split(/\s+/)[0] || order.customerName;

  const body = [
    hero({
      headline: "Votre commande est bien reçue !",
      sub: `Merci ${esc(firstName)}. Elle est enregistrée chez nous et nous la prenons en charge — vous recevrez un e-mail à chaque étape.`,
      picture: true,
    }),
    refAndDate(order),
    button("Suivre ma commande", url),
    progress("PENDING"),
    sectionTitle("Détails de votre commande", "Voir le récapitulatif complet", url),
    items(order),
    totals(order),
    logistics(order, shop),
    nextStepsNote(order),
    assurances(order, shop),
    signoff(shop),
  ].join("");

  const text = [
    `Votre commande ${order.ref} est bien reçue — ${shop.name}`,
    ``,
    `Merci ${firstName}. Elle est enregistrée chez nous et nous la prenons en charge ; vous recevrez un e-mail à chaque étape.`,
    ``,
    `Numéro de commande : ${order.ref}`,
    `Date de commande : ${fmtWhen(order.createdAt)}`,
    ``,
    ...textLines(order, shop),
    ``,
    `Suivre ma commande : ${url}`,
    ``,
    shop.phone ? `Une question ? Appelez le ${shop.phone} ou répondez à cet e-mail.` : `Une question ? Répondez simplement à cet e-mail.`,
    ``,
    `À très bientôt,`,
    `L'équipe ${shop.name}`,
  ].join("\n");

  return {
    to: order.email,
    subject: `Commande ${order.ref} bien reçue — ${shop.name}`,
    html: shell({
      title: `Commande ${order.ref}`,
      preheader: `${order.ref} · ${count} article${count > 1 ? "s" : ""} · ${formatTNDfr(order.total)}`,
      kicker: `Commande ${order.ref}`,
      shop,
      body,
    }),
    text,
    replyTo: shop.email ?? undefined,
  };
}

/* ---------------------------------------------------- to the shop -------- */

export function newOrderAlertMail(order: OrderForEmail, shop: ShopForEmail): Mail | null {
  // Nowhere to send it until the owner fills in the shop address in
  // /admin/parametres. Silence beats mailing a placeholder.
  if (!shop.email) return null;

  const adminUrl = `${siteUrl()}/admin/commandes/${order.id}`;
  const count = order.items.reduce((n, i) => n + i.qty, 0);

  const customer = row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:10px;"><tr><td style="padding:14px 16px;">
      <div style="font-family:${FONT_DISPLAY};font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">Client</div>
      <div style="margin-top:4px;font-family:${FONT_HEAD};font-size:18px;font-weight:800;color:${NAVY};">${esc(order.customerName)}</div>
      <div style="margin-top:4px;font-family:${FONT};font-size:14px;line-height:1.7;color:${INK};">
        <a href="tel:${esc(order.phone.replace(/\s+/g, ""))}" style="color:${INK};text-decoration:none;">${esc(order.phone)}</a>
        ${order.email ? `&nbsp;·&nbsp; <a href="mailto:${esc(order.email)}" style="color:${NAVY};text-decoration:underline;">${esc(order.email)}</a>` : `&nbsp;·&nbsp; <span style="color:${MUTED};">pas d'e-mail</span>`}
        ${order.userId ? `<br><span style="color:${MUTED};">Client avec compte</span>` : `<br><span style="color:${MUTED};">Commande sans compte</span>`}
      </div>
    </td></tr></table>`,
    "padding:22px 28px 0;"
  );

  const note = order.notes
    ? row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbea;border-left:4px solid ${GOLD};border-radius:0 10px 10px 0;"><tr><td style="padding:12px 14px;font-family:${FONT};font-size:14px;line-height:1.6;color:${INK};">
          <strong>Note du client :</strong> ${esc(order.notes)}
        </td></tr></table>`,
        "padding:14px 28px 0;"
      )
    : "";

  const body = [
    hero({
      tone: "navy",
      headline: `Nouvelle commande ${esc(order.ref)}`,
      sub: `${esc(fmtWhen(order.createdAt))} &nbsp;·&nbsp; ${count} article${count > 1 ? "s" : ""} &nbsp;·&nbsp; <strong style="color:${NAVY};">${esc(formatTNDfr(order.total))}</strong>`,
    }),
    customer,
    button("Ouvrir dans l'admin", adminUrl, "navy"),
    sectionTitle("Articles commandés"),
    items(order),
    totals(order),
    logistics(order, shop),
    note,
    row("", "padding:0 0 28px;"),
  ].join("");

  const text = [
    `Nouvelle commande ${order.ref} — ${formatTNDfr(order.total)}`,
    `${fmtWhen(order.createdAt)}`,
    ``,
    `Client : ${order.customerName}`,
    `Téléphone : ${order.phone}`,
    order.email ? `E-mail : ${order.email}` : `E-mail : (aucun)`,
    ``,
    ...textLines(order, shop),
    ...(order.notes ? [``, `Note du client : ${order.notes}`] : []),
    ``,
    `Ouvrir dans l'admin : ${adminUrl}`,
  ].join("\n");

  return {
    to: shop.email,
    subject: `Nouvelle commande ${order.ref} — ${formatTNDfr(order.total)}`,
    html: shell({
      title: `Nouvelle commande ${order.ref}`,
      preheader: `${order.customerName} · ${order.phone} · ${count} article${count > 1 ? "s" : ""}`,
      kicker: "Espace boutique",
      shop,
      body,
    }),
    text,
    // So the shop can reply straight to the customer from its inbox.
    replyTo: order.email ?? undefined,
  };
}

/* ------------------------------------------ status moved on -------------- */

/** What each status means to the person waiting, in the shop's own words.
 *  PENDING is absent on purpose: it is the state the confirmation email
 *  already covers, and a second message saying the same thing is noise.
 *  Keys are the Prisma OrderStatus values — a typo here sends nothing for
 *  that transition, silently. */
const STATUS_COPY: Record<string, { subject: string; headline: string; line: (o: OrderForEmail, w: string | null) => string; tone: "green" | "navy" | "red" }> = {
  CONFIRMED: {
    subject: "confirmée",
    headline: "Votre commande est confirmée",
    line: () => "Nous l'avons vérifiée et elle part en préparation.",
    tone: "green",
  },
  PREPARED: {
    subject: "préparée",
    headline: "Votre commande est prête",
    line: (o) => (o.deliveryMethod === "PICKUP" ? "Elle vous attend en magasin." : "Elle est emballée et part à la livraison."),
    tone: "green",
  },
  SHIPPED: {
    subject: "expédiée",
    headline: "Votre commande est en route",
    line: (_o, w) => (w ? `Elle a quitté nos locaux. Délai indicatif : ${w}.` : "Elle a quitté nos locaux."),
    tone: "green",
  },
  DELIVERED: {
    subject: "livrée",
    headline: "Votre commande est livrée",
    line: () => "Merci de votre confiance. Si une pièce ne correspond pas, répondez à cet e-mail : nous nous en occupons.",
    tone: "green",
  },
  CANCELLED: {
    subject: "annulée",
    headline: "Votre commande est annulée",
    line: () => "Si vous n'êtes pas à l'origine de cette annulation, répondez à cet e-mail et nous verrons cela ensemble.",
    tone: "red",
  },
};

export function orderStatusMail(order: OrderForEmail, status: string, shop: ShopForEmail): Mail | null {
  const copy = STATUS_COPY[status];
  if (!copy || !order.email) return null;

  const url = orderUrl(order);
  const window = deliveryWindow(order, shop);
  const line = copy.line(order, window);

  const body = [
    hero({ tone: copy.tone, headline: copy.headline, sub: esc(line) }),
    refAndDate(order),
    button("Voir ma commande", url),
    status === "CANCELLED" ? "" : progress(status),
    sectionTitle("Rappel de votre commande", "Voir le récapitulatif complet", url),
    items(order),
    totals(order),
    status === "CANCELLED" ? "" : logistics(order, shop),
    status === "CANCELLED" ? "" : assurances(order, shop),
    signoff(shop),
  ].join("");

  const text = [
    `${copy.headline} — ${order.ref}`,
    ``,
    line,
    ``,
    `Numéro de commande : ${order.ref}`,
    `Date de commande : ${fmtWhen(order.createdAt)}`,
    ``,
    ...textLines(order, shop),
    ``,
    `Voir ma commande : ${url}`,
    ``,
    `L'équipe ${shop.name}`,
  ].join("\n");

  return {
    to: order.email,
    subject: `Commande ${order.ref} ${copy.subject} — ${shop.name}`,
    html: shell({
      title: `Commande ${order.ref}`,
      preheader: `${copy.headline} · ${order.ref}`,
      kicker: `Commande ${order.ref}`,
      shop,
      body,
    }),
    text,
    replyTo: shop.email ?? undefined,
  };
}

/* ------------------------------------------------- forgot my password ---- */

/**
 * The one message that is not about an order. Short on purpose: a button, how
 * long it works, what to do if it was not you. The link is repeated as text
 * for the mail clients that strip buttons of their href.
 */
export function passwordResetMail(user: { name: string; email: string }, url: string, shop: ShopForEmail): Mail {
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const body = [
    hero({
      tone: "navy",
      glyph: "&#128273;",
      headline: "Réinitialiser votre mot de passe",
      sub: `Bonjour ${esc(firstName)}. Une demande de nouveau mot de passe a été faite pour ce compte — par vous, normalement.`,
    }),
    button("Choisir un nouveau mot de passe", url),
    row(
      `<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY};">
        Ce lien est valable <strong>une heure</strong> et ne sert qu'une fois. Si vous n'avez rien demandé, ignorez
        simplement ce message : votre mot de passe reste inchangé et personne n'a accédé à votre compte.
      </p>`,
      "padding:22px 28px 0;"
    ),
    row(
      `<p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};word-break:break-all;">
        Si le bouton ne réagit pas, copiez cette adresse dans votre navigateur :<br>
        <a href="${esc(url)}" style="color:${NAVY};">${esc(url)}</a>
      </p>`,
      "padding:14px 28px 0;"
    ),
    signoff(shop),
  ].join("");

  const text = [
    `Réinitialiser votre mot de passe — ${shop.name}`,
    ``,
    `Bonjour ${firstName}. Une demande de nouveau mot de passe a été faite pour ce compte.`,
    ``,
    `Choisir un nouveau mot de passe : ${url}`,
    ``,
    `Ce lien est valable une heure et ne sert qu'une fois. Si vous n'avez rien demandé, ignorez ce message : votre mot de passe reste inchangé.`,
    ``,
    `L'équipe ${shop.name}`,
  ].join("\n");

  return {
    to: user.email,
    subject: `Réinitialisation de votre mot de passe — ${shop.name}`,
    html: shell({
      title: "Réinitialiser votre mot de passe",
      preheader: "Valable une heure, une seule fois.",
      kicker: "Compte client",
      shop,
      body,
      reason: "qu'un nouveau mot de passe a été demandé sur %HOST% pour le compte lié à cette adresse",
    }),
    text,
    replyTo: shop.email ?? undefined,
  };
}
