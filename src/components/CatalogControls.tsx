"use client";

import { useRouter } from "next/navigation";
import { filterHref, toggleBrand } from "@/lib/catalog-filters";

type BrandFacet = { name: string; slug: string; count: number };

/**
 * Above the grid: which brands are currently ticked, each removable on its
 * own, and the sort order.
 *
 * The sort `<select>` has to know the active brands too — changing "Prix
 * croissant" to "Popularité" used to drop whichever single brand was
 * selected, because it only ever knew about one. Now that several can be
 * ticked at once it has to carry the whole set through.
 */
export default function CatalogControls({
  basePath,
  brands,
  activeBrandSlugs,
  activeSort,
}: {
  basePath: string;
  brands: BrandFacet[];
  activeBrandSlugs: string[];
  activeSort?: string;
}) {
  const router = useRouter();

  function onSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(filterHref(basePath, activeBrandSlugs, e.target.value || undefined));
  }

  return (
    <div className="flex items-start justify-between mb-4 gap-3">
      {activeBrandSlugs.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {activeBrandSlugs.map((slug) => {
            // A brand can drop out of the facet list (out of stock, unset)
            // while it is still in the URL from an earlier visit; fall back
            // to the slug rather than rendering an empty chip.
            const name = brands.find((b) => b.slug === slug)?.name ?? slug;
            return (
              <a
                key={slug}
                href={filterHref(basePath, toggleBrand(activeBrandSlugs, slug), activeSort)}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-navy-900 text-white font-medium"
              >
                {name} <span aria-hidden="true">✕</span>
              </a>
            );
          })}
        </div>
      ) : (
        <span />
      )}
      <select
        defaultValue={activeSort ?? ""}
        onChange={onSortChange}
        className="shrink-0 text-sm border border-gray-300 rounded-lg px-2.5 min-h-tap outline-none"
      >
        <option value="">Popularité</option>
        <option value="price-asc">Prix croissant</option>
        <option value="price-desc">Prix décroissant</option>
      </select>
    </div>
  );
}
