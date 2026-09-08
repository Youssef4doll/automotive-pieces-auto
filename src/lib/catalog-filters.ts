/**
 * The category listing's brand checkboxes, as pure URL math.
 *
 * The three places that build a filtered link — the desktop sidebar, the
 * phone's chip row, and the "remove this filter" chip above the grid — used
 * to each hand-roll their own querystring, back when a shopper could only
 * ever have one brand selected at a time. Turning that into a real checkbox
 * filter (several brands at once, OR'd together) meant the same three places
 * now had to agree on how a *set* of brands round-trips through one `brand`
 * query parameter, so that logic lives here once instead of three times.
 *
 * No client-only or server-only API in sight: this runs in a server
 * component while building `getProductsForCategory`'s options, and in the
 * client components that render the links.
 */

/** `"kamoka,ashika"` → `["kamoka", "ashika"]`. Never invents a brand: an
 *  unknown slug that survives the round trip just matches nothing. */
export function parseBrandParam(raw?: string): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

/** Add the slug if it is not selected, drop it if it is. */
export function toggleBrand(current: string[], slug: string): string[] {
  return current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
}

/** The href for a given brand selection and sort, dropping empty params
 *  rather than writing `?brand=&sort=`. */
export function filterHref(basePath: string, brandSlugs: string[], sort?: string): string {
  const params = new URLSearchParams();
  if (brandSlugs.length > 0) params.set("brand", brandSlugs.join(","));
  if (sort) params.set("sort", sort);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
