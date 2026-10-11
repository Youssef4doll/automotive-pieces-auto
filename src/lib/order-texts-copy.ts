import type { DeliveryEstimate } from "@/lib/delivery-estimate";

/**
 * What the text messages about an order say (the owner, October 2026: "a
 * message at every step, and a delay said before the customer asks").
 *
 * Pure, so it is tested without a database or a provider. In French, the
 * shop's language on paper and on the phone; each starts with the shop's
 * name, because a text from an unknown sender id is the first thing a
 * customer deletes. Every sentence is a fact the shop holds: the reference,
 * the amount to pay, the date it promised (lib/delivery-estimate) — and the
 * courier calling before coming, the owner's own promise.
 */

export type TextStatus = "PENDING" | "CONFIRMED" | "PREPARED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

const DAY = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const DAY_ONLY = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", timeZone: "UTC" });

/** "10:00" → "10 h", "10:30" → "10 h 30". */
export function frenchClock(hhmm: string) {
  const [h, m] = hhmm.split(":");
  return m && m !== "00" ? `${Number(h)} h ${m}` : `${Number(h)} h`;
}

/**
 * "mardi 7 octobre, 10 h–18 h", "entre jeudi 8 et samedi 10 octobre",
 * "entre vendredi 30 octobre et lundi 2 novembre" — the estimate as a
 * French sentence ends it.
 */
export function frenchEstimate(e: DeliveryEstimate): string {
  const from = new Date(`${e.from}T00:00:00Z`);
  const to = new Date(`${e.to}T00:00:00Z`);
  const hours = e.window ? `, ${frenchClock(e.window.start)}–${frenchClock(e.window.end)}` : "";
  if (e.from === e.to) return `${DAY.format(from)}${hours}`;
  const sameMonth = from.getUTCMonth() === to.getUTCMonth();
  return `entre ${sameMonth ? DAY_ONLY.format(from) : DAY.format(from)} et ${DAY.format(to)}${hours}`;
}

export type TextOrder = {
  shop: string;
  ref: string;
  total: string;
  deliveryMethod: "DELIVERY" | "PICKUP";
  estimate: DeliveryEstimate | null;
};

/** The text for an order that just moved to `status`, or null when that step needs none. */
export function orderStatusText(status: TextStatus, o: TextOrder): string | null {
  const head = `${o.shop} : `;
  const when = o.estimate ? ` Livraison estimée : ${frenchEstimate(o.estimate)}.` : "";
  switch (status) {
    case "PENDING":
      return `${head}commande ${o.ref} bien reçue (${o.total}, paiement à la livraison). Nous vous confirmons très vite.${o.deliveryMethod === "DELIVERY" ? when : ""}`;
    case "CONFIRMED":
      return o.deliveryMethod === "DELIVERY"
        ? `${head}votre commande ${o.ref} est confirmée.${when}`
        : `${head}votre commande ${o.ref} est confirmée. Nous vous prévenons dès qu'elle est prête au magasin.`;
    case "PREPARED":
      // For a delivery the next news is the van; for a pickup it is "come and get it".
      return o.deliveryMethod === "PICKUP" ? `${head}votre commande ${o.ref} est prête au magasin. Nous vous attendons.` : null;
    case "SHIPPED":
      return `${head}votre commande ${o.ref} est en route — le livreur vous appelle avant de passer. À payer à la livraison : ${o.total}.`;
    case "DELIVERED":
      return `${head}commande ${o.ref} livrée, merci. Une pièce ne va pas ? Le retour se fait en 3 gestes depuis la commande, dans l'app.`;
    case "CANCELLED":
      return `${head}votre commande ${o.ref} a été annulée. Une question ? Répondez depuis l'app, la boutique vous lit.`;
  }
}

/** Said once, before the customer has to ask, when the promised date will be missed (lib/order-delays). */
export function orderDelayText(o: TextOrder & { shipped: boolean }): string {
  const head = `${o.shop} : `;
  const e = o.estimate;
  const missed = !e
    ? "a pris du retard"
    : e.from === e.to
      ? `a pris du retard et n'arrivera pas ${DAY.format(new Date(`${e.to}T00:00:00Z`))} comme prévu`
      : "a pris du retard et n'arrivera pas dans les délais annoncés";
  return o.shipped
    ? `${head}désolés, votre commande ${o.ref} ${missed}. Elle est chez le livreur, qui vous appelle avant de passer.`
    : `${head}désolés, votre commande ${o.ref} ${missed}. Nous vous prévenons dès qu'elle part.`;
}
