/**
 * Catalogue mistakes a machine can point at, for /admin/qualite.
 *
 * The September 2026 audit found, in the live catalogue: a subcategory named
 * "rrr", a TOTAL product named "… DELPHI", a VAICO product named "… DENSO".
 * None is a code bug and none can be fixed by code — the shop fixes them in
 * the admin. What code can do is find them before a customer does. Pure
 * functions, so the rules are tested rather than eyeballed.
 */

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const word = (name: string) => new RegExp(`(^|[^a-z0-9])${fold(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);

/**
 * Another brand's name in the product's title, and not its own: "Bougie
 * DELPHI" filed under TOTAL. `brands` is every brand name in the catalogue.
 * Names shorter than three letters are ignored — too many false hits.
 */
export function brandInNameMismatch(productName: string, ownBrand: string | null, brands: string[]): string | null {
  if (!ownBrand) return null;
  const title = fold(productName);
  if (word(ownBrand).test(title)) return null;
  const other = brands.find((b) => b.length >= 3 && fold(b) !== fold(ownBrand) && word(b).test(title));
  return other ?? null;
}

/** A category name that looks like a test or a slip of the keyboard: "rrr", "aa", "xyz1". */
export function suspiciousCategoryName(name: string): boolean {
  const n = fold(name.trim());
  if (n.length < 3) return true;
  // Three of a letter inside one word ("rrr", "fffreinage"); across a space
  // is ordinary French ("butée élastique" folds to "butee elastique").
  if (n.split(/\s+/).some((w) => /(.)\1\1/.test(w))) return true;
  if (!/[aeiou]/.test(n)) return true;
  return /^(test|essai|tmp|xxx|todo)\b/.test(n);
}
