import { partIconMarkup } from "@/lib/part-icons";

/**
 * A drawn icon per part family, for the tiles nobody has photographed yet.
 *
 * The fallback used to be the family's first letter in a grey square, which
 * made a board of sixteen families read as sixteen identical placeholders —
 * "F" for Filtres sitting beside "F" for Freinage told the shopper nothing and
 * looked unfinished. The big European catalogues lead these boards with a
 * drawing of the part, because a picture of a brake disc is recognisable to
 * somebody who does not know the French word for it, which is exactly the
 * customer this shop keeps losing.
 *
 * The drawings themselves live in src/lib/part-icons, because the product
 * cards need the same set as a standalone SVG and two copies would drift. They
 * are a fallback only: the moment the shop uploads a real photograph in
 * /admin/catalogue, that photograph wins. Anything unrecognised gets a generic
 * part outline rather than a letter — a wrong-looking icon would be worse than
 * a neutral one, so nothing here guesses.
 */
export default function FamilyIcon({ slug, className = "" }: { slug: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      // Our own literal path data from the module above, never anything a
      // user supplied — this is the one way to render the same characters the
      // SVG route serves without keeping a second copy of them as JSX.
      dangerouslySetInnerHTML={{ __html: partIconMarkup(slug) }}
    />
  );
}
