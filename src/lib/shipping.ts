/**
 * What delivery costs, in one place.
 *
 * The same rule was written out three times — in the checkout form, in the
 * order action that actually charges it, and nowhere at all on the cart page,
 * which is how the cart came to show a "Total" that was not the total. A fee
 * the customer is quoted and a fee the shop charges must be the same number
 * by construction, not by three copies agreeing.
 *
 * It is deliberately not governorate-dependent: the shop charges one flat fee
 * anywhere in Tunisia and waives it over a threshold. That is what makes it
 * safe to state on the cart page, before an address is known.
 */

/** Flat delivery fee, in DT, when it applies at all. */
export const FLAT_DELIVERY_FEE = 8;

export type DeliveryMethod = "DELIVERY" | "PICKUP";

export function shippingFeeFor(
  subtotal: number,
  freeShippingThreshold: number,
  method: DeliveryMethod = "DELIVERY",
): number {
  if (method === "PICKUP") return 0;
  if (subtotal >= freeShippingThreshold) return 0;
  return FLAT_DELIVERY_FEE;
}

/**
 * What the cart can promise before it knows how the order will be delivered.
 *
 * The cart has no address and no delivery method yet, so it quotes the
 * home-delivery figure — the one that can only go down at checkout, never up.
 * Quoting the cheaper case and surprising someone at the last step is the
 * behaviour this whole module exists to stop.
 */
export function cartDeliveryQuote(
  subtotal: number,
  freeShippingThreshold: number,
  /** Droit de timbre, from lib/tax. Flat, so the cart can quote it honestly
   *  before it knows anything about the order — and it has to, because it is
   *  charged at checkout and this total may not go up there. */
  stampDuty = 0,
) {
  const fee = shippingFeeFor(subtotal, freeShippingThreshold, "DELIVERY");
  return {
    fee,
    stampDuty,
    total: subtotal + fee + stampDuty,
    free: fee === 0,
    /** How much more would earn free delivery, or 0 once it is earned. */
    remainingForFree: Math.max(0, freeShippingThreshold - subtotal),
  };
}
