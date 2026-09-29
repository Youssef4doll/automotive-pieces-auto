import { RETURN_DAYS, WARRANTY_MONTHS } from "./policy";

/**
 * Returns, as the shop's own policy page writes them (/livraison-retours,
 * "Retours" and "Garantie"). Nothing here is a new promise; each rule quotes
 * a sentence of that page, and the page stays the reference:
 *
 *   "14 jours à compter de la réception pour nous retourner une pièce qui ne
 *   vous convient pas. La pièce doit être dans son état d'origine : non
 *   montée, non rayée, dans son emballage, avec les accessoires."
 *
 *   "Si l'erreur vient de nous — pièce incompatible alors que vous nous aviez
 *   donné votre véhicule, référence différente de celle commandée, pièce
 *   abîmée à l'arrivée — le retour et le remplacement sont à notre charge.
 *   Signalez-le-nous dans les 48 heures avec une photo."
 *
 *   "12 mois sur les pièces que nous vendons, contre les défauts de
 *   fabrication, à compter de la date de livraison. La garantie couvre la
 *   pièce ; elle ne couvre ni la main-d'œuvre de dépose et repose, ni les
 *   dommages causés par un montage incorrect […]."
 *
 * Pure, so the rules are tested without a database, and computed on the
 * server for every screen that shows them: the app and the website draw the
 * deadlines and the "à notre charge" line from this answer, never from a
 * copy of their own.
 */

export const RETURN_REASONS = ["WRONG_PART", "DAMAGED", "DOES_NOT_FIT", "DEFECTIVE", "NOT_NEEDED"] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export const RETURN_WISHES = ["EXCHANGE", "REFUND"] as const;
export type ReturnWish = (typeof RETURN_WISHES)[number];

/** "Signalez-le-nous dans les 48 heures avec une photo." */
export const SHOP_ERROR_HOURS = 48;
export const MAX_RETURN_PHOTOS = 4;

/**
 * Who carries the cost, as the policy says it — and no further.
 *
 *   shop      the shop's error: return and replacement at its charge.
 *   warranty  a manufacturing defect: the part is covered, the labour is not.
 *   standard  a part that does not suit: the 14-day return, on the policy's
 *             conditions. The page says nothing about who pays the trip back
 *             in this case, so neither does anything built on this.
 */
export type ReturnCover = "shop" | "warranty" | "standard";

export type ReasonOption = {
  reason: ReturnReason;
  /** Still within its deadline. */
  open: boolean;
  /** The last moment it can be sent, ISO. */
  until: string;
  photo: "required" | "optional";
  /** The customer declares the part was never fitted, in its packaging. */
  unmounted: boolean;
  cover: ReturnCover;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function addMonths(d: Date, months: number) {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

/**
 * What this delivered order can still be returned for, one entry per reason,
 * closed ones included (the screen says "le délai est passé" rather than
 * hiding the reason, so a customer is never left wondering where it went).
 *
 * `vehicleGiven`: the order carried the car it was chosen for. That is what
 * turns "it does not fit" into the shop's error — the policy's "alors que
 * vous nous aviez donné votre véhicule".
 */
export function returnOptions(deliveredAt: Date, vehicleGiven: boolean, now: Date = new Date()): ReasonOption[] {
  const shopErrorUntil = new Date(deliveredAt.getTime() + SHOP_ERROR_HOURS * HOUR);
  const returnUntil = new Date(deliveredAt.getTime() + RETURN_DAYS * DAY);
  const warrantyUntil = addMonths(deliveredAt, WARRANTY_MONTHS);
  const fitIsOurs = vehicleGiven && now <= shopErrorUntil;

  const option = (reason: ReturnReason, until: Date, rest: Omit<ReasonOption, "reason" | "open" | "until">): ReasonOption => ({
    reason,
    open: now <= until,
    until: until.toISOString(),
    ...rest,
  });

  return [
    option("WRONG_PART", shopErrorUntil, { photo: "required", unmounted: false, cover: "shop" }),
    option("DAMAGED", shopErrorUntil, { photo: "required", unmounted: false, cover: "shop" }),
    option(
      "DOES_NOT_FIT",
      returnUntil,
      fitIsOurs
        ? { photo: "required", unmounted: true, cover: "shop" }
        : { photo: "optional", unmounted: true, cover: "standard" },
    ),
    option("DEFECTIVE", warrantyUntil, { photo: "optional", unmounted: false, cover: "warranty" }),
    option("NOT_NEEDED", returnUntil, { photo: "optional", unmounted: true, cover: "standard" }),
  ];
}

/** Quantity of each order line still free to return: bought, minus what is already in a live request. */
export function returnableQty(
  lines: { id: string; qty: number }[],
  claimed: { orderItemId: string; qty: number }[],
): Map<string, number> {
  const used = new Map<string, number>();
  for (const c of claimed) used.set(c.orderItemId, (used.get(c.orderItemId) ?? 0) + c.qty);
  return new Map(lines.map((l) => [l.id, Math.max(0, l.qty - (used.get(l.id) ?? 0))]));
}

export type ReturnProblem = "closed" | "no_items" | "qty" | "photo_required" | "unmounted_required";

/**
 * Whether a request can be filed as sent. The first problem wins; null when
 * it can. Everything a customer could have got wrong on the form is checked
 * again here, because the form is not the only way to reach the route.
 */
export function returnProblem(
  input: { reason: ReturnReason; items: { orderItemId: string; qty: number }[]; photos: number; unmounted: boolean },
  options: ReasonOption[],
  free: Map<string, number>,
): ReturnProblem | null {
  const rule = options.find((o) => o.reason === input.reason);
  if (!rule || !rule.open) return "closed";
  const lines = input.items.filter((i) => i.qty > 0);
  if (!lines.length) return "no_items";
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.orderItemId)) return "qty";
    seen.add(line.orderItemId);
    const left = free.get(line.orderItemId);
    if (left === undefined || !Number.isInteger(line.qty) || line.qty > left) return "qty";
  }
  if (rule.photo === "required" && input.photos < 1) return "photo_required";
  if (rule.unmounted && !input.unmounted) return "unmounted_required";
  return null;
}

/** The value of what is being returned at the prices charged — a starting figure for the shop, never a promise. */
export function returnValue(lines: { qty: number; unitPrice: number }[]): number {
  return Math.round(lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0) * 100) / 100;
}

/**
 * The life of a request. A customer can withdraw it only while the shop has
 * not answered; after that the shop moves it on, one step at a time.
 */
export const RETURN_STATUSES = ["REQUESTED", "APPROVED", "REFUSED", "RECEIVED", "RESOLVED", "CANCELLED"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const RETURN_NEXT: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ["APPROVED", "REFUSED", "CANCELLED"],
  APPROVED: ["RECEIVED", "REFUSED"],
  RECEIVED: ["RESOLVED"],
  REFUSED: [],
  RESOLVED: [],
  CANCELLED: [],
};

/** Requests that still hold their quantities. */
export const LIVE_RETURN: ReturnStatus[] = ["REQUESTED", "APPROVED", "RECEIVED", "RESOLVED"];
