/**
 * Promo codes: the arithmetic, with no database in sight.
 *
 * The cart quote and the order both call `promoVerdict` with the row they
 * read themselves, so the discount a customer is shown and the discount
 * they are charged are one computation. A client sends a code, never an
 * amount — there is nowhere in either request body to put one.
 */

export type PromoKind = "PERCENT" | "AMOUNT";

export type PromoRow = {
  code: string;
  kind: PromoKind;
  value: number;
  minSubtotal: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number | null;
  active: boolean;
};

/** Why a code was refused — the app words each one in its own languages. */
export type PromoProblem = "unknown" | "inactive" | "not_started" | "expired" | "used_up" | "min_subtotal" | "too_many";

export type PromoVerdict =
  | { ok: true; code: string; kind: PromoKind; value: number; discount: number }
  | { ok: false; reason: PromoProblem; minSubtotal?: number };

/** A percent code above this is a typo in the admin, not a promotion. */
export const MAX_PERCENT = 90;
export const CODE_PATTERN = /^[A-Z0-9-]{3,24}$/;

/** "  ete 10 " → "ETE10". Customers type codes the way they read them off a poster. */
export function normalizeCode(raw: string): string {
  return raw.normalize("NFKC").toUpperCase().replace(/[\s_]+/g, "").slice(0, 40);
}

/** Money to the dinar's hundredth, which is what the order columns hold. */
function cents(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Does this code apply to a basket of `subtotal`, now, having been used
 * `uses` times already? And if so, for how much.
 *
 * The discount comes off the parts only, and never takes them below zero —
 * delivery and the droit de timbre are charged on what is left.
 */
export function promoVerdict(promo: PromoRow | null, subtotal: number, uses: number, now: Date): PromoVerdict {
  if (!promo) return { ok: false, reason: "unknown" };
  if (!promo.active) return { ok: false, reason: "inactive" };
  if (promo.startsAt && now < promo.startsAt) return { ok: false, reason: "not_started" };
  if (promo.endsAt && now > promo.endsAt) return { ok: false, reason: "expired" };
  if (promo.maxUses != null && uses >= promo.maxUses) return { ok: false, reason: "used_up" };
  if (promo.minSubtotal != null && subtotal < promo.minSubtotal) {
    return { ok: false, reason: "min_subtotal", minSubtotal: promo.minSubtotal };
  }
  const raw =
    promo.kind === "PERCENT"
      ? (subtotal * Math.min(Math.max(promo.value, 0), MAX_PERCENT)) / 100
      : Math.max(promo.value, 0);
  const discount = cents(Math.min(raw, subtotal));
  return { ok: true, code: promo.code, kind: promo.kind, value: promo.value, discount };
}

/** What the admin form may save. Returns the French message for the first problem, or null. */
export function promoFormProblem(input: {
  code: string;
  kind: PromoKind;
  value: number;
  minSubtotal: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number | null;
}): string | null {
  if (!CODE_PATTERN.test(input.code)) return "Le code : 3 à 24 lettres, chiffres ou tirets.";
  if (!Number.isFinite(input.value) || input.value <= 0) return "La remise doit être supérieure à zéro.";
  if (input.kind === "PERCENT" && input.value > MAX_PERCENT) return `Une remise en pourcentage ne dépasse pas ${MAX_PERCENT} %.`;
  if (input.kind === "AMOUNT" && input.minSubtotal != null && input.value > input.minSubtotal) {
    return "La remise ne peut pas dépasser le montant minimum du panier.";
  }
  if (input.minSubtotal != null && input.minSubtotal < 0) return "Le montant minimum ne peut pas être négatif.";
  if (input.maxUses != null && (!Number.isInteger(input.maxUses) || input.maxUses < 1)) return "Le nombre d'utilisations doit être un entier positif.";
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) return "La date de fin doit suivre la date de début.";
  return null;
}
