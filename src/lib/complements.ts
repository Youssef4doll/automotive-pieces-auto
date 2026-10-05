/**
 * Which part families make sense next to which, for "souvent achetés
 * ensemble" — the rule that keeps an air filter from being offered beside
 * a pair of brake pads just because two maintenance baskets held both.
 *
 * Applied to co-purchases only. A link the shop set by hand (ProductLink) is
 * the shop's own judgement and is shown as it is.
 *
 * Keys and values are top-level family slugs. A family missing from the
 * table complements only itself.
 */
const COMPLEMENTS: Record<string, string[]> = {
  freinage: ["freinage"],
  filtres: ["filtres", "lubrifiant"],
  lubrifiant: ["lubrifiant", "filtres"],
  "courroie-tendeur-et-chaine": ["courroie-tendeur-et-chaine", "moteur", "refroidissement-moteur"],
  moteur: ["moteur", "courroie-tendeur-et-chaine", "refroidissement-moteur", "lubrifiant", "filtres"],
  "refroidissement-moteur": ["refroidissement-moteur", "moteur", "lubrifiant", "courroie-tendeur-et-chaine"],
  embrayage: ["embrayage"],
  suspension: ["suspension", "direction-et-trains-roulants"],
  "direction-et-trains-roulants": ["direction-et-trains-roulants", "suspension"],
  "cardan-et-transmission": ["cardan-et-transmission", "direction-et-trains-roulants", "lubrifiant"],
  "allumage-prechauffage": ["allumage-prechauffage", "filtres"],
  "demarrage-electrique": ["demarrage-electrique", "courroie-tendeur-et-chaine"],
  climatisation: ["climatisation", "filtres"],
  "capteurs-et-sondes": ["capteurs-et-sondes", "allumage-prechauffage"],
};

type Part = { family: string; axle: "AVANT" | "ARRIERE" | null };

/**
 * Does `other` belong next to `part`? Same or complementary family, and —
 * when both say which axle they are for — the same axle: front pads go with
 * front discs, not rear ones.
 */
export function complements(part: Part, other: Part): boolean {
  const allowed = COMPLEMENTS[part.family] ?? [part.family];
  if (!allowed.includes(other.family)) return false;
  if (part.axle && other.axle && part.axle !== other.axle) return false;
  return true;
}
