/**
 * Turning what was typed into what can be matched — the character layer.
 *
 * Split out from normalize.ts so the vocabulary in synonyms.ts can fold its
 * own aliases without the two files importing each other in a circle.
 *
 * Everything here is pure and dependency-free: the same folding runs in the
 * browser (to key the suggestion cache) and on the server (to build a query),
 * and the two must agree character for character or a part becomes
 * unreachable.
 */

/**
 * Arabic is not one spelling.
 *
 * A customer typing on a phone writes بطارية; the same word arrives from
 * another keyboard as بطاريه, and a copy-and-paste from a workshop invoice
 * may carry vowel marks or a tatweel stretching the letters. None of those are
 * different words, so they are all folded onto one form before anything tries
 * to match them — the same job accent-stripping does for French.
 */
const ARABIC_FOLD: [RegExp, string][] = [
  [/[آأإٱ]/g, "ا"], // آ أ إ ٱ → ا
  [/ى/g, "ي"], //  ى → ي
  [/ة/g, "ه"], //  ة → ه
  [/ؤ/g, "و"], //  ؤ → و
  [/ئ/g, "ي"], //  ئ → ي
  [/[ً-ٰٕ]/g, ""], //  vowel marks and the dagger alef
  [/ـ/g, ""], //  tatweel, the decorative stretch
];

/** ٠١٢… and ۰۱۲… are the same digits as 012…, and references are full of them. */
function latinDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.codePointAt(0)!;
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/**
 * Lower case, accents removed, punctuation turned into spaces — and Arabic
 * kept rather than thrown away.
 *
 * "Filtre à huile" and "FILTRE A HUILE" and "filtre-a-huile" all fold to the
 * same string. Accents in particular are not optional: half the phones in
 * Tunisia type French without them.
 *
 * Arabic letters used to be stripped here along with the punctuation, which
 * left `fold("فلتر زيت")` as the empty string — so a search in Arabic, on a
 * site that ships an Arabic translation, returned nothing at all and could
 * not even be recorded as a miss. They survive now, folded onto one spelling,
 * and the vocabulary in synonyms.ts is what turns them into the French wording
 * the catalogue is actually written in.
 */
export function fold(input: string): string {
  let s = latinDigits(input);
  for (const [pattern, to] of ARABIC_FOLD) s = s.replace(pattern, to);
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ء-ي]+/g, " ")
    .trim();
}

/**
 * Could this token ever appear in the search index?
 *
 * The index is built from the catalogue's own rows — French part names, French
 * category names, Latin references — so a word with no Latin character in it
 * cannot match, and requiring it guarantees an empty page. Used to decide what
 * is a hard requirement and what is merely context.
 */
export function hasLatin(token: string): boolean {
  return /[a-z0-9]/.test(token);
}
