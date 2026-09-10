/**
 * The category listing's filters, as pure URL math.
 *
 * Every place that builds a filtered link — the desktop sidebar, the phone's
 * chip row, the "remove this filter" chips above the grid, the sort select,
 * the price slider — used to hand-roll its own querystring, back when the only
 * filter was one brand. Now that a shopper can combine several brands, a price
 * band, "in stock only" and a sort order, all of them have to agree on how that
 * whole state round-trips through the URL, so it lives here once.
 *
 * The URL is the state, deliberately: a filtered page can be shared, comes back
 * from the browser's history intact, and works with JavaScript off, since the
 * sidebar's rows are plain links.
 *
 * No client-only or server-only API in sight: this runs in a server component
 * while building `getProductsForCategory`'s options, and in the client
 * components that render the links.
 */

export type CatalogFilters = {
  /** OR'd together — a checkbox filter, not a single choice. */
  brands: string[];
  sort?: string;
  /** Price band in DT, inclusive. Absent means unbounded on that side. */
  min?: number;
  max?: number;
  /** Only parts that can be bought right now. */
  stock?: boolean;
};

export const EMPTY_FILTERS: CatalogFilters = { brands: [] };

/** `"kamoka,ashika"` → `["kamoka", "ashika"]`. Never invents a brand: an
 *  unknown slug that survives the round trip just matches nothing. */
export function parseBrandParam(raw?: string): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

/** What the page's `searchParams` say, with anything malformed dropped rather
 *  than passed to the database. */
export function parseFilters(sp: {
  brand?: string;
  sort?: string;
  min?: string;
  max?: string;
  stock?: string;
}): CatalogFilters {
  const price = (v?: string) => {
    if (v === undefined || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
  };
  const min = price(sp.min);
  const max = price(sp.max);
  return {
    brands: parseBrandParam(sp.brand),
    sort: sp.sort || undefined,
    // A band typed in backwards is not an error worth showing; it is swapped.
    min: min !== undefined && max !== undefined && min > max ? max : min,
    max: min !== undefined && max !== undefined && min > max ? min : max,
    stock: sp.stock === "1" || undefined,
  };
}

/** Add the slug if it is not selected, drop it if it is. */
export function toggleBrand(current: string[], slug: string): string[] {
  return current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
}

/** How many filters are narrowing the list — for the "Filtres (2)" button. */
export function activeFilterCount(f: CatalogFilters): number {
  return f.brands.length + (f.min !== undefined || f.max !== undefined ? 1 : 0) + (f.stock ? 1 : 0);
}

/** The href for a filter state, dropping empty params rather than writing
 *  `?brand=&sort=`. Parameter order is fixed so the same state is always the
 *  same URL. */
export function filterHref(basePath: string, f: CatalogFilters): string {
  const params = new URLSearchParams();
  if (f.brands.length > 0) params.set("brand", f.brands.join(","));
  if (f.sort) params.set("sort", f.sort);
  if (f.min !== undefined) params.set("min", String(f.min));
  if (f.max !== undefined) params.set("max", String(f.max));
  if (f.stock) params.set("stock", "1");
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
