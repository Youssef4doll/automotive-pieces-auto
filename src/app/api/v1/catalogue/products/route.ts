import { NextRequest } from "next/server";
import { z } from "zod";
import { listAppProducts } from "@/lib/data/catalog";
import { Cache, fail, guard, ok, preflight } from "../../_lib/respond";

const slug = z.string().trim().min(1).max(64);
const id = z.string().trim().min(1).max(64);
const page = z.coerce.number().int().min(1).max(500);

const PUBLIC = { cache: Cache.catalogue, cors: true };

/**
 * A page of parts, optionally judged against the customer's engine.
 *
 * `engine` is the engine id from the garage. When it is supplied every row
 * carries a fitment verdict — FITS, UNKNOWN or DOES_NOT_FIT — and when it is
 * not, the verdict is null. Those are three different answers plus "we have
 * not been told your car", and the app says something different for each.
 *
 * UNKNOWN is the common one and is not a failure: most of this catalogue has
 * no fitment rows, so for most parts the shop genuinely does not know. A part
 * with no rows is never reported as fitting.
 *
 * `fits=1` goes further and returns only the parts that do have a row for
 * that engine — the shop's confirmed list for one car. It is a narrower
 * question than the verdict above and it has to be asked of the database:
 * filtering a page client-side would report "nothing fits your car" whenever
 * the first twenty rows happened to hold none.
 */
export async function GET(request: NextRequest) {
  return guard(
    async () => {
      const params = request.nextUrl.searchParams;

      const family = params.get("family");
      const subcategory = params.get("subcategory");
      const engine = params.get("engine");
      const pageParam = params.get("page");
      const brand = params.get("brand");

      // `fits=1` narrows the page to parts with a fitment row for that
      // engine. Only meaningful alongside `engine`; asking for it without one
      // is a caller bug rather than an empty result, so it is refused rather
      // than quietly ignored.
      const fits = params.get("fits") === "1";
      if (fits && engine === null) return fail("bad_request", PUBLIC);

      // Bounded up front so an unbounded string never reaches a query, and so
      // a caller cannot walk the catalogue a thousand pages at a time.
      const parsed = {
        family: family === null ? undefined : slug.safeParse(family),
        subcategory: subcategory === null ? undefined : slug.safeParse(subcategory),
        engine: engine === null ? undefined : id.safeParse(engine),
        page: pageParam === null ? undefined : page.safeParse(pageParam),
        brand: brand === null ? undefined : slug.safeParse(brand),
      };

      for (const value of Object.values(parsed)) {
        if (value && !value.success) return fail("bad_request", PUBLIC);
      }

      const result = await listAppProducts({
        familySlug: parsed.family?.success ? parsed.family.data : undefined,
        subcategorySlug: parsed.subcategory?.success ? parsed.subcategory.data : undefined,
        engineId: parsed.engine?.success ? parsed.engine.data : undefined,
        fitsEngineOnly: fits,
        brandSlug: parsed.brand?.success ? parsed.brand.data : undefined,
        page: parsed.page?.success ? parsed.page.data : 1,
      });

      return ok(result, PUBLIC);
    },
    "catalogue/products",
    PUBLIC,
  );
}

export const OPTIONS = preflight;
