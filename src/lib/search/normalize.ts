import { expandQuery } from "./synonyms";

/**
 * Turning what was typed into what can be matched.
 *
 * Everything here is deliberately pure and dependency-free: the same folding
 * runs in the browser (to key the suggestion cache), on the server (to build
 * a query) and in SQL (to build the index blob), and the three must agree
 * character for character or a part becomes unreachable.
 */

/**
 * Lower case, accents removed, punctuation turned into spaces.
 *
 * "Filtre à huile" and "FILTRE A HUILE" and "filtre-a-huile" all fold to the
 * same string. Accents in particular are not optional: half the phones in
 * Tunisia type French without them.
 */
export function fold(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Words too common to narrow anything down. Position words are NOT here. */
const STOPWORDS = new Set([
  "de", "du", "des", "la", "le", "les", "l", "d", "un", "une",
  "pour", "et", "ou", "a", "au", "aux", "en", "sur", "avec",
  "the", "for", "of", "and",
]);

/**
 * French plural → singular, for the endings that actually occur in parts
 * wording. Deliberately conservative: over-eager stemming turns "pneus" into
 * "pne" and loses more than it finds.
 */
export function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("aux")) return `${word.slice(0, -3)}al`; // normaux → normal
  if (word.endsWith("eaux")) return word.slice(0, -1); // tuyeaux → tuyeau
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export type ParsedQuery = {
  /** The query as typed, trimmed. */
  raw: string;
  /** Folded: lower case, no accents, single spaces. */
  folded: string;
  /** Catalogue wording the query was recognised as ("kit distri" → …). */
  canonical: string[];
  /**
   * Every distinct token to require in the index, singularised — the canonical
   * terms' own words plus whatever the vocabulary did not recognise.
   */
  tokens: string[];
  /** Folded + expanded, the string handed to the trigram matcher. */
  fuzzyText: string;
};

/**
 * One place that decides what a query means, used by search, suggestions and
 * the demand log alike — so the buying list groups "plaquete" with
 * "Plaquettes de frein" instead of listing them as two different wants.
 */
export function parseQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim();
  const folded = fold(trimmed);
  const { canonical, rest } = expandQuery(folded);

  const tokens = [
    ...new Set(
      [...canonical.flatMap((c) => c.split(" ")), ...rest]
        .filter((w) => w.length > 0 && !STOPWORDS.has(w))
        .map(singular),
    ),
  ];

  return {
    raw: trimmed,
    folded,
    canonical,
    tokens,
    fuzzyText: [...canonical, ...rest].join(" ").trim() || folded,
  };
}
