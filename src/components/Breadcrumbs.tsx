import Link from "next/link";

export type Crumb = { name: string; path: string };

/**
 * The trail, as navigation rather than decoration.
 *
 * Marked up as an ordered list inside a labelled `<nav>` so a screen reader
 * announces it as a breadcrumb trail and can skip it; the current page is the
 * last item, is not a link, and carries `aria-current="page"`. Pair it with
 * `breadcrumbSchema` from `lib/schema` for the machine-readable copy.
 */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Fil d'Ariane" className="text-xs text-gray-500">
      <ol className="flex items-center gap-1.5 flex-wrap">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.path} className="flex items-center gap-1.5">
              {last ? (
                <span aria-current="page" className="text-gray-700 font-medium">
                  {c.name}
                </span>
              ) : (
                <>
                  <Link
                    href={c.path}
                    className="hover:text-navy-900 inline-flex items-center min-h-tap -my-2 transition-colors"
                  >
                    {c.name}
                  </Link>
                  <span aria-hidden="true" className="text-gray-300">
                    ›
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
