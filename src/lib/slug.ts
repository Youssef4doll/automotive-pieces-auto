// Slugs are part of the public URL of every category and product, so they have
// to survive French accents ("Démarrage" -> "demarrage") rather than dropping
// the letter. NFD splits "é" into "e" + a combining accent, and ̀-ͯ
// is the combining-diacritics block that the second replace strips.
export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
