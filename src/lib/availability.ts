/**
 * What the shop can actually promise about one part, in one place.
 *
 * The storefront used to answer this in two words — "En stock" or "Rupture de
 * stock" — and the second one was a lie about how this shop works. It
 * warehouses a little and telephones its supplier for the rest, so an empty
 * shelf is usually a delay, not a refusal. A page that answers "rupture" to
 * that turns a sale the shop wanted into a WhatsApp message it has to chase.
 *
 * Three answers now, and each is derived from something the shop has actually
 * recorded — never from a guess:
 *
 *   EN STOCK               there are units on the shelf (stockQty > 0)
 *   DISPONIBLE SUR COMMANDE nothing on the shelf, but the part is marked
 *                          ON_ORDER, which is the shop saying it can source it
 *   INDISPONIBLE           nothing on the shelf and marked UNAVAILABLE
 *
 * The delay quoted for a sur-commande part comes from one shop setting
 * (`supplier_lead_time`). It is empty until the owner fills it in, and an
 * empty one means the page says "sur commande" and stops there rather than
 * naming a number nobody has committed to.
 */

export type SupplyMode = "ON_ORDER" | "UNAVAILABLE";

export type Availability = "IN_STOCK" | "ON_ORDER" | "UNAVAILABLE";

export type AvailabilityView = {
  state: Availability;
  /** What the badge says. */
  label: string;
  /** The line under it, or null when there is nothing true to add. */
  detail: string | null;
  /** Whether this part can be put in a basket at all. */
  buyable: boolean;
  /** Whether buying it means the shop has to order it in first. */
  backorder: boolean;
};

export function availabilityOf(product: { stockQty: number; supply: SupplyMode }): Availability {
  if (product.stockQty > 0) return "IN_STOCK";
  return product.supply === "ON_ORDER" ? "ON_ORDER" : "UNAVAILABLE";
}

/**
 * The same three states, dressed for the page.
 *
 * `lowStockThreshold` is the shop's own per-part figure, so "plus que 2" is
 * the shop's definition of nearly gone rather than a number this file picked.
 * It is stated as a count, never as urgency: "il ne reste que 2 articles —
 * dépêchez-vous" is the thing this project does not do.
 */
export function availabilityView(
  product: { stockQty: number; supply: SupplyMode; lowStockThreshold?: number },
  /** `supplier_lead_time` from the shop's settings. Empty until it is set. */
  leadTime?: string | null,
): AvailabilityView {
  const state = availabilityOf(product);
  const lead = leadTime?.trim() || null;

  if (state === "IN_STOCK") {
    const low =
      product.lowStockThreshold !== undefined && product.stockQty <= product.lowStockThreshold;
    return {
      state,
      label: "En stock",
      detail: low ? `${product.stockQty} en stock` : null,
      buyable: true,
      backorder: false,
    };
  }

  if (state === "ON_ORDER") {
    return {
      state,
      label: "Disponible sur commande",
      // Named only when the shop has named it. Without the setting this says
      // that the part is ordered in, and nothing about when — which is all
      // anybody here actually knows.
      detail: lead ? `Nous la commandons chez notre fournisseur · ${lead}` : "Nous la commandons chez notre fournisseur",
      buyable: true,
      backorder: true,
    };
  }

  return {
    state,
    label: "Indisponible",
    detail: "Cette référence n'est plus approvisionnée.",
    buyable: false,
    backorder: false,
  };
}

/** Badge colours, so a card and a product page can never disagree. */
export const AVAILABILITY_TONE: Record<Availability, { dot: string; text: string; chip: string }> = {
  IN_STOCK: { dot: "bg-green-600", text: "text-green-700", chip: "bg-green-50 border-green-200 text-green-800" },
  ON_ORDER: { dot: "bg-gold-500", text: "text-navy-900", chip: "bg-gold-500/10 border-gold-500/40 text-navy-900" },
  UNAVAILABLE: { dot: "bg-gray-400", text: "text-gray-500", chip: "bg-gray-100 border-gray-200 text-gray-600" },
};
