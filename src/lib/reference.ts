/**
 * Part references are written down inconsistently by everyone: the constructor
 * stamps "77 01 234 567", the supplier catalogue lists "7701234567", the
 * mechanic types "7701 234-567". They are the same part. Matching therefore
 * happens on a normalised form, never on the raw string.
 */
export function normalizeReference(input: string): string {
  return input
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * A query is worth treating as a part reference when it looks like one: it
 * contains digits, has no spaces once normalised, and is long enough not to be
 * a stray word. "frein" is not a reference; "GDB1330" and "7701234567" are.
 * Getting this wrong in either direction is cheap — a reference lookup that
 * finds nothing simply falls through to full-text search.
 */
export function looksLikeReference(query: string): boolean {
  const n = normalizeReference(query);
  if (n.length < 4 || n.length > 32) return false;
  if (!/[0-9]/.test(n)) return false;
  // At least a third of it should be digits, otherwise it is a product name
  // that happens to carry a number ("huile 5w30").
  const digits = (n.match(/[0-9]/g) ?? []).length;
  return digits / n.length >= 0.33;
}

/** Split a pasted list of references — commas, semicolons, pipes or newlines. */
export function parseReferenceList(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[,;|\n\r\t]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

export const REFERENCE_TYPE_LABEL: Record<string, string> = {
  OEM: "Référence constructeur",
  AFTERMARKET: "Référence équipementier",
  EQUIVALENT: "Référence équivalente",
};
