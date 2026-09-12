"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@/i18n/LocaleProvider";
import { filterHref, toggleBrand, type CatalogFilters } from "@/lib/catalog-filters";
import type { CategoryFacets } from "@/lib/data/catalog";

type BrandFacet = { name: string; slug: string; count: number };

/**
 * The bar above the grid: how many parts are on screen, which filters are
 * narrowing the list (each removable on its own), the sort order, and grid or
 * list.
 *
 * Every link and the sort select carry the *whole* filter state through.
 * Changing "Prix croissant" to "Pertinence" used to drop whichever single
 * brand was selected, because it only ever knew about one; a price band or an
 * "en stock" tick would have gone the same way.
 */
export default function CatalogControls({
  basePath,
  brands,
  filters,
  facets,
  count,
  view,
  onView,
}: {
  basePath: string;
  brands: BrandFacet[];
  filters: CatalogFilters;
  facets: CategoryFacets;
  /** What is on screen right now, after the vehicle filter too. */
  count: number;
  view: "grid" | "list";
  onView: (v: "grid" | "list") => void;
}) {
  const { t } = useLocale();
  const router = useRouter();

  const chips: { key: string; label: string; href: string }[] = [
    ...filters.brands.map((slug) => ({
      key: `brand-${slug}`,
      // A brand can drop out of the facet list (out of stock, unset) while it
      // is still in the URL from an earlier visit; fall back to the slug
      // rather than rendering an empty chip.
      label: brands.find((b) => b.slug === slug)?.name ?? slug,
      href: filterHref(basePath, { ...filters, brands: toggleBrand(filters.brands, slug) }),
    })),
    ...(filters.min !== undefined || filters.max !== undefined
      ? [
          {
            key: "price",
            label: `${filters.min ?? facets.priceMin} – ${filters.max ?? facets.priceMax} DT`,
            href: filterHref(basePath, { ...filters, min: undefined, max: undefined }),
          },
        ]
      : []),
    ...(filters.stock
      ? [{ key: "stock", label: t("cat.inStockOnly"), href: filterHref(basePath, { ...filters, stock: undefined }) }]
      : []),
  ];

  const toggle = (active: boolean) =>
    `inline-flex items-center justify-center w-10 min-h-tap-compact transition-colors ${
      active ? "bg-gold-500 text-navy-950" : "bg-white text-gray-500 hover:text-navy-900"
    }`;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <p className="text-sm text-gray-600">
          <strong className="font-semibold text-navy-950">{count}</strong> référence{count > 1 ? "s" : ""}
        </p>
        {chips.map((c) => (
          <a
            key={c.key}
            href={c.href}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 min-h-tap-compact rounded-full bg-navy-900 text-white font-medium"
          >
            {c.label} <span aria-hidden="true">✕</span>
          </a>
        ))}
      </div>

      {/* Wraps: with the view toggle now offered on a phone too, the sort
          control and the toggle together are wider than a 320px screen, and
          without this the whole page scrolled sideways. */}
      <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
        {/* One control, labelled inline the way the mock reads: "Trier par :
            Pertinence". The label is part of the tap target. */}
        <label className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white ps-3 pe-1.5 min-h-tap text-sm text-gray-700">
          <span className="whitespace-nowrap text-gray-500">{t("cat.sortBy")} :</span>
          <select
            value={filters.sort ?? ""}
            onChange={(e) => router.push(filterHref(basePath, { ...filters, sort: e.target.value || undefined }))}
            className="bg-transparent outline-none font-semibold text-navy-950 min-h-tap-compact pe-1"
          >
            <option value="">{t("cat.relevance")}</option>
            <option value="price-asc">{t("cat.priceAsc")}</option>
            <option value="price-desc">{t("cat.priceDesc")}</option>
          </select>
        </label>

        {/* Grid or list, on every screen including a phone.
            The toggle used to be hidden below sm, on the grounds that a list
            of tall cards is longer than the grid it replaces. That was true of
            the list as it was then. It is a compact row now — picture on the
            left, everything else beside it, the way the Tunisian shops that
            sell the most parts lay theirs out — and it is the layout that has
            room for the reference and a line of description. Two honest
            options, and the shopper picks; the grid is still the default. */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden" role="group" aria-label="Affichage">
          <button type="button" aria-pressed={view === "grid"} aria-label={t("cat.gridView")} onClick={() => onView("grid")} className={toggle(view === "grid")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </button>
          <button type="button" aria-pressed={view === "list"} aria-label={t("cat.listView")} onClick={() => onView("list")} className={`${toggle(view === "list")} border-s border-gray-300`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
