import type { SettingsMap } from "@/lib/settings";

/**
 * TVA and droit de timbre, in one place.
 *
 * Two facts about selling parts in Tunisia drive everything here:
 *
 *  1. Consumer prices are quoted TTC. The price on the shelf, on the card and
 *     in the cart is the price paid, VAT included. So the TVA line on a
 *     document is a **decomposition of money already counted**, never an
 *     addition to it — the total a customer sees must be the total they were
 *     charged, and this module exists partly to make that impossible to get
 *     wrong by arithmetic.
 *
 *  2. The droit de timbre is different: it is a real extra dinar, levied per
 *     invoice. It is therefore added, which means it has to be quoted from the
 *     cart onwards — see lib/shipping.ts for why a total is never allowed to
 *     go up at the next step.
 *
 * Both are switched on by one thing: the shop's matricule fiscal. A trader
 * without one cannot charge VAT and does not issue factures, which is already
 * why the printable document is titled "Reçu" until the matricule is filled
 * in. With no matricule the policy is zeroed and every total reads exactly as
 * it did before any of this existed.
 */

/** What the shop charges, snapshotted onto each order at checkout. */
export type TaxPolicy = {
  /** TVA rate as a percentage — 19, 13, 7, or 0 for "not VAT registered". */
  vatRate: number;
  /** Droit de timbre in DT, added once per order. 0 when not charged. */
  stampDuty: number;
};

export const NO_TAX: TaxPolicy = { vatRate: 0, stampDuty: 0 };

/** DT are quoted to the millime; every figure here is rounded the same way. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function positive(value: string | undefined, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(round2(n), max);
}

/**
 * The shop's tax position, read from settings — never typed into a page.
 *
 * Returns zeroes unless the matricule fiscal is set, so a shop that has not
 * declared itself VAT-registered cannot accidentally start charging VAT
 * because somebody left a rate in a form field.
 */
export function taxPolicy(settings: SettingsMap): TaxPolicy {
  if (!settings.shop_tax_id.trim()) return NO_TAX;
  return {
    vatRate: positive(settings.vat_rate, 100),
    stampDuty: positive(settings.stamp_duty, 100),
  };
}

/** Everything a totals block needs, from what is stored on the order. */
export type TaxBreakdown = {
  /** True when there is a TVA line to show at all. */
  taxed: boolean;
  vatRate: number;
  /** The parts, excluding VAT. Equals the subtotal when untaxed. */
  goodsHT: number;
  /** The delivery fee, excluding VAT. Equals the fee when untaxed. */
  shippingHT: number;
  /** VAT on the parts and the delivery together. */
  vat: number;
  stampDuty: number;
  /** goodsHT + shippingHT + vat + stampDuty, to the millime. */
  total: number;
};

/**
 * Split what was charged into the lines a Tunisian facture is made of.
 *
 * `subtotal` and `shippingFee` are TTC, as stored on the order. The VAT line
 * deliberately absorbs the rounding of both HT figures rather than being
 * rounded itself, so the four lines always add up to the total exactly — a
 * document whose column does not sum is worse than one with no VAT line on it.
 */
export function taxBreakdown({
  subtotal,
  shippingFee,
  vatRate,
  stampDuty,
}: {
  subtotal: number;
  shippingFee: number;
} & TaxPolicy): TaxBreakdown {
  const charged = round2(subtotal + shippingFee);
  if (vatRate <= 0) {
    return {
      taxed: false,
      vatRate: 0,
      goodsHT: round2(subtotal),
      shippingHT: round2(shippingFee),
      vat: 0,
      stampDuty: round2(stampDuty),
      total: round2(charged + stampDuty),
    };
  }
  const divisor = 1 + vatRate / 100;
  const goodsHT = round2(subtotal / divisor);
  const shippingHT = round2(shippingFee / divisor);
  return {
    taxed: true,
    vatRate,
    goodsHT,
    shippingHT,
    vat: round2(charged - goodsHT - shippingHT),
    stampDuty: round2(stampDuty),
    total: round2(charged + stampDuty),
  };
}

/**
 * "19 %" — French spacing, and no trailing zeros on a whole rate.
 */
export function vatRateLabel(rate: number): string {
  return `${rate.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
}

/**
 * What a price on a card includes, said once.
 *
 * "TVA 19 % incluse" is true only of a shop that charges la TVA. Everywhere
 * else this is null and the card prints nothing, because "prix TTC" on a
 * receipt that carries no VAT line is a claim about a tax position the shop
 * does not have.
 */
export function priceNote(settings: SettingsMap): string | null {
  const { vatRate } = taxPolicy(settings);
  return vatRate > 0 ? `TVA ${vatRateLabel(vatRate)} incluse` : null;
}
