import { expandQuery } from "./synonyms";
import { fold, hasLatin } from "./fold";

/**
 * Turning what was typed into what it means.
 *
 * Deliberately pure and dependency-free: the same reading runs in the browser
 * (to key the suggestion cache) and on the server (to build a query), and the
 * two must agree or a part becomes unreachable. The character layer — case,
 * accents, Arabic spellings — lives in ./fold.
 */

export { fold } from "./fold";

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
/**
 * How a French word sounds, written the catalogue's way — for the words a
 * customer spells by ear: "plakette" → "plaquette", "filtr" stays, "frain" →
 * "frein", "amortiseur" → "amortisseur", "fare" → "phare". Applied only to a
 * word the vocabulary did not recognise as typed, and kept only when the
 * respelling IS recognised, so "kit" is never turned into "cit".
 */
export function soundAlike(word: string): string[] {
  const out = new Set<string>();
  const add = (w: string) => w !== word && out.add(w);
  add(word.replace(/k(?=[eiy])/g, "qu").replace(/k/g, "c"));
  add(word.replace(/k/g, "qu"));
  add(word.replace(/ain/g, "ein"));
  add(word.replace(/([aeiou])s([aeiou])/g, "$1ss$2"));
  add(word.replace(/^f/, "ph"));
  add(word.replace(/ph/g, "f"));
  add(word.replace(/(.)\1/g, "$1"));
  add(word.replace(/ete?$/, "ette"));
  // All of them at once: "plakete" needs both k → qu and -ete → -ette.
  add(
    word
      .replace(/k(?=[eiy])/g, "qu")
      .replace(/k/g, "c")
      .replace(/ph/g, "f")
      .replace(/ain/g, "ein")
      .replace(/([aeiou])s([aeiou])/g, "$1ss$2")
      .replace(/ete?$/, "ette"),
  );
  return [...out];
}

export function parseQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim();
  const folded = fold(trimmed);
  const expanded = expandQuery(folded);
  const canonical = [...expanded.canonical];
  let rest = expanded.rest;
  // Spelt by ear: an unrecognised word whose sound-alike IS in the
  // vocabulary is read as that word (soundAlike).
  rest = rest.filter((word) => {
    for (const variant of soundAlike(word)) {
      const hit = expandQuery(variant).canonical;
      if (hit.length) {
        for (const c of hit) if (!canonical.includes(c)) canonical.push(c);
        return false;
      }
    }
    return true;
  });

  // A word the vocabulary did not recognise and that carries no Latin
  // character cannot appear in the index — the catalogue is written in French
  // — so it is context, not a requirement. Requiring it is how "فلتر زيت
  // كليو" found nothing while "فلتر زيت" found the oil filters: every token
  // has to match, and كليو never can. The unrecognised Arabic is still in
  // `folded`, so the demand log records what was really typed.
  const indexable = rest.filter(hasLatin);

  const tokens = [
    ...new Set(
      [...canonical.flatMap((c) => c.split(" ")), ...indexable]
        .filter((w) => w.length > 0 && !STOPWORDS.has(w))
        .map(singular),
    ),
  ];

  return {
    raw: trimmed,
    folded,
    canonical,
    tokens,
    // Likewise for the trigram comparison: the blob it is compared against is
    // French, so Arabic in here only drags the similarity down.
    fuzzyText: [...canonical, ...indexable].join(" ").trim() || folded,
  };
}
