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

/** One reference, and the maker whose number it is. Empty owner = unattributed. */
export type OwnedReference = { owner: string; raw: string };

/**
 * A reference list that can say whose numbers these are.
 *
 * An OE number is only half an answer on its own. "1611349280" is a wiper
 * blade to nobody; "PEUGEOT 1611349280" is the number a mechanic reads off the
 * old part and the number the customer's garage will quote back. The
 * catalogues that matter in this trade all publish them grouped by carmaker,
 * and a flat comma list cannot be grouped after the fact — the attribution has
 * to be entered, so the entry format has to accept it.
 *
 *   RENAULT: 77 01 234 567, 8200123456
 *   DACIA: 6001549444
 *   GDB1330
 *
 * A line with a name and a colon attributes everything after it; a bare line
 * is kept unattributed rather than dropped, so the format an admin already
 * knows keeps working and nothing has to be re-typed. The owner is uppercased
 * because that is how every catalogue in the trade prints it and because it
 * stops "Renault" and "RENAULT" becoming two groups on the page.
 */
export function parseOwnedReferenceList(input: string): OwnedReference[] {
  const out: OwnedReference[] = [];
  const seen = new Set<string>();

  for (const line of input.split(/[\n\r]+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // The owner is a name, not a reference: letters, spaces and the few marks
    // that appear in carmaker names (CITROËN, MERCEDES-BENZ, ALFA ROMEO).
    // Requiring at least one letter and no digits keeps a reference that
    // happens to contain a colon from being read as a heading.
    const split = trimmed.match(/^([\p{L}][\p{L}\s.&'’-]{0,39}):\s*(.+)$/u);
    const owner = split ? split[1].trim().toUpperCase() : "";
    const rest = split ? split[2] : trimmed;

    for (const raw of parseReferenceList(rest)) {
      // Deduplicated on owner + normalised form, which is the pair the
      // database makes unique. The same number under two carmakers is two
      // rows on purpose; the same number typed twice under one is one.
      const key = `${owner}|${normalizeReference(raw)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ owner, raw });
    }
  }
  return out;
}

/** OE numbers as the page prints them: one block per carmaker. */
export type OeGroup = { owner: string; refs: { raw: string; normalized: string }[] };

/**
 * The OE numbers of one part, grouped by the carmaker that stamps them.
 *
 * Two sources feed this, which is not an accident waiting to happen but the
 * shape of the data: `PartReference` rows carry the attribution and are what
 * the admin writes today, and `Product.oemRefs` is the older flat array the
 * seed and the importer fill. Numbers already present as attributed rows are
 * not repeated; the rest are kept, unattributed, rather than dropped — a
 * number the shop holds is worth printing even when nobody has said whose it
 * is, because it is still the number a mechanic will search for.
 *
 * Groups come out in alphabetical order with the unattributed block last, and
 * numbers inside a group in the order they are printed.
 */
export function groupOeReferences(
  rows: { brand: string; raw: string; normalized: string }[],
  legacy: string[] = [],
): OeGroup[] {
  const groups = new Map<string, Map<string, string>>();
  const known = new Set<string>();

  const add = (owner: string, raw: string, normalized: string) => {
    if (normalized.length < 3) return;
    const group = groups.get(owner) ?? new Map<string, string>();
    if (!group.has(normalized)) group.set(normalized, raw);
    groups.set(owner, group);
    known.add(normalized);
  };

  for (const r of rows) add(r.brand.trim().toUpperCase(), r.raw, r.normalized);
  for (const raw of legacy) {
    const normalized = normalizeReference(raw);
    if (!known.has(normalized)) add("", raw, normalized);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "fr")))
    .map(([owner, refs]) => ({
      owner,
      refs: [...refs.entries()].map(([normalized, raw]) => ({ raw, normalized })),
    }));
}

/**
 * The stored rows, back in the shape the textarea accepts.
 *
 * Round-tripping matters more than it sounds: an admin correcting one digit
 * has to see what is saved, edit it, and save it back without the attribution
 * quietly collapsing. Attributed owners come first in alphabetical order,
 * unattributed numbers last on one line.
 */
export function formatOwnedReferenceList(refs: OwnedReference[]): string {
  const groups = new Map<string, string[]>();
  for (const r of refs) {
    const list = groups.get(r.owner) ?? [];
    list.push(r.raw);
    groups.set(r.owner, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "fr")))
    .map(([owner, list]) => (owner ? `${owner}: ${list.join(", ")}` : list.join(", ")))
    .join("\n");
}
