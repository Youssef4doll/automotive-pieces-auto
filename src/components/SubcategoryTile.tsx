import Link from "next/link";
import CategoryThumb from "./CategoryThumb";

/**
 * One subcategory, as a picture you can tap — not a line of text with a
 * number after it.
 *
 * Both places that browse a family's subcategories (the desktop mega-menu's
 * flyout panel and the homepage's expanded family card) used to list them as
 * rows: a small icon, the name, a count in parentheses. That reads fine once
 * you already know "Disque de frein" from "Kit de plaquettes de frein" by
 * name — and is a wall of French nouns for anyone who does not, which is the
 * shopper this component exists for. A tile leads with the shape of the part
 * instead, the way a shelf in a real parts counter is arranged.
 *
 * The count is deliberately not shown here. It is one tap away on the
 * category page itself, and putting it on every tile crowded a picture-led
 * grid with a second, smaller kind of information — the two panels this
 * replaced disagreed with each other about whether to call it "(8)" or
 * "8 références", which was itself a sign it did not need to be here twice.
 */
export default function SubcategoryTile({
  href,
  slug,
  imageUrl,
  name,
  onClick,
  size = 56,
}: {
  href: string;
  slug: string;
  imageUrl: string | null;
  name: string;
  onClick?: () => void;
  size?: number;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 p-2 rounded-lg text-center hover:bg-gray-50"
    >
      <CategoryThumb
        slug={slug}
        imageUrl={imageUrl}
        size={size}
        className="ring-1 ring-gray-100 group-hover:ring-gold-500 transition-colors"
      />
      <span className="line-clamp-2 text-[13px] font-semibold text-navy-800 leading-snug group-hover:text-red-600 [overflow-wrap:anywhere]">
        {name}
      </span>
    </Link>
  );
}
