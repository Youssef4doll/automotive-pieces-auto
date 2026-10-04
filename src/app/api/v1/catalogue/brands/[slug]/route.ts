import { getBrandFamilies } from "@/lib/data/catalog";
import { Cache, fail, guard, ok, preflight } from "../../../_lib/respond";

/**
 * One parts maker, for the app's brand page: its name and uploaded mark
 * (`logoUrl`, or null — the app then sets the name in type, never a logo of
 * its own), how many of its parts are on sale, and the families those parts
 * are in, each with its count. 404 for a slug that is not a parts maker with
 * something on sale.
 */
export const OPTIONS = preflight;

const PUBLIC = { cache: Cache.catalogue, cors: true } as const;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return guard(
    async () => {
      const { slug } = await params;
      const page = await getBrandFamilies(slug.slice(0, 120));
      return page ? ok(page, PUBLIC) : fail("not_found", PUBLIC);
    },
    "catalogue/brand",
    { cors: true },
  );
}
