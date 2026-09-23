import { getPartsBrands } from "@/lib/data/catalog";
import { Cache, guard, ok, preflight } from "../../_lib/respond";

/**
 * The parts makers the shop carries — the app's "Nos marques" strip — from
 * the same read as the website's brand board (getPartsBrands): only makers
 * with at least one part on sale, each with the count of those parts.
 *
 * `logoUrl` is the mark uploaded in /admin/catalogue/marques, or null; the
 * app then sets the name in type. It never draws a maker's logo of its own —
 * that would be an invented trademark.
 */
export const OPTIONS = preflight;

export async function GET() {
  return guard(
    async () => {
      const brands = await getPartsBrands();
      const data = brands
        .map((b) => ({ id: b.id, name: b.name, slug: b.slug, logoUrl: b.logoUrl, productCount: b._count.products }))
        .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name, "fr"));
      return ok(data, { cache: Cache.catalogue, cors: true });
    },
    "catalogue/brands",
    { cors: true },
  );
}
