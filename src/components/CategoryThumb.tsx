import Image from "next/image";

/**
 * The picture beside a category's name.
 *
 * Sixteen families and a hundred and twenty-eight subcategories are a lot of
 * French nouns to read in a column, and "Transmission" versus "Direction et
 * suspension" is a distinction a shopper makes faster from a shape than from a
 * label. So every row in the navigation carries a picture.
 *
 * Where it comes from, in order:
 *
 *  1. The photo the shop uploaded for that category, from /admin/catalogue.
 *     Families and subcategories both take one; it is stored in Postgres like
 *     every other image here and served from /api/images/[id].
 *  2. Failing that, the line drawing for the family, from /api/part-icon/[slug]
 *     — which resolves a subcategory up to its parent, so a subcategory with no
 *     picture of its own still shows the right kind of part rather than a grey
 *     box.
 *
 * That second one is the placeholder, and it is the whole reason there is
 * something to look at today: no category has a photograph yet. Uploading one
 * replaces it with no code change, one category at a time.
 *
 * `alt` is empty on purpose. The name is always rendered next to it, and a
 * screen reader announcing "Freinage, Freinage" is worse than silence.
 */
export default function CategoryThumb({
  slug,
  imageUrl,
  size = 40,
  className = "",
}: {
  slug: string;
  /** The uploaded picture, or null — then the family drawing stands in. */
  imageUrl: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`relative shrink-0 overflow-hidden rounded-lg bg-slate-50 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={imageUrl ?? `/api/part-icon/${slug}.svg`}
        alt=""
        fill
        sizes={`${size}px`}
        className="object-contain p-[8%]"
      />
    </span>
  );
}
