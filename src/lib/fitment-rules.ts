/**
 * Physical rules that no fitment row can overrule.
 *
 * A fitment row says "this part fits this engine". Rows come from people and
 * from imports, and both make mistakes — the September 2026 audit found NGK
 * spark plugs "fitting" a BMW 320d, which has no spark plugs, and a customer
 * had ordered them. Some parts only exist for one fuel. When a row claims
 * otherwise, the row is wrong, and the storefront says "does not fit" rather
 * than repeat it.
 *
 * Deliberately short: only parts that are fuel-exclusive by construction.
 * An air filter or a brake disc says nothing about fuel, so gets no rule.
 */

export type FuelKind = "PETROL" | "DIESEL";

/** Category-slug fragments and name patterns of parts that need one fuel. */
const PETROL_ONLY = {
  slugs: ["bougie-d-allumage", "bobine-d-allumage", "fiche-bobine-d-allumage", "faisceau-d-allumage", "allumeur"],
  name: /\b(bougies?|bobines?|faisceau) d['’ ]?allumage\b/i,
};
const DIESEL_ONLY = {
  slugs: ["bougie-de-prechauffage", "relais-de-prechauffage", "boitier-de-prechauffage", "filtre-a-particules"],
  name: /\b(bougies? de pr[ée]chauffage|relais de pr[ée]chauffage|filtre [àa] particules|\bFAP\b)/i,
};

/** Which fuel a part needs, from its category slug and name; null when it has no such rule. */
export function fuelNeedOf(categorySlug: string, name: string): FuelKind | null {
  if (PETROL_ONLY.slugs.some((s) => categorySlug.includes(s)) || PETROL_ONLY.name.test(name)) return "PETROL";
  if (DIESEL_ONLY.slugs.some((s) => categorySlug.includes(s)) || DIESEL_ONLY.name.test(name)) return "DIESEL";
  return null;
}

/**
 * The engine's fuel as a rule can read it. Hybrids and LPG conversions are
 * petrol engines with spark plugs; anything unrecognised (electric, blank)
 * gets no rule rather than a guess.
 */
export function engineFuelKind(fuel: string | null | undefined): FuelKind | null {
  if (!fuel) return null;
  const f = fuel.toLowerCase();
  if (f.includes("diesel") || f.includes("gazole")) return "DIESEL";
  if (f.includes("essence") || f.includes("petrol") || f.includes("gasoline") || f.includes("gpl") || f.includes("hybrid") || f.includes("hybride")) return "PETROL";
  return null;
}

/** True when the part physically cannot fit an engine running on this fuel. */
export function fuelContradicts(categorySlug: string, name: string, engineFuel: string | null | undefined): boolean {
  const need = fuelNeedOf(categorySlug, name);
  const kind = engineFuelKind(engineFuel);
  return Boolean(need && kind && need !== kind);
}

/** Prisma `where` for parts that need the OTHER fuel than `kind` — to exclude from "fits" lists. */
export function needsOtherFuelWhere(kind: FuelKind) {
  const rule = kind === "DIESEL" ? PETROL_ONLY : DIESEL_ONLY;
  return {
    OR: rule.slugs.map((s) => ({ category: { slug: { contains: s } } })),
  };
}
