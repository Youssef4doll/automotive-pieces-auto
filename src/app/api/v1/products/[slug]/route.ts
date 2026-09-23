import { NextRequest } from "next/server";
import { z } from "zod";
import { getAppProduct } from "@/lib/data/app-catalog";
import { Cache, fail, guard, ok, preflight } from "../../_lib/respond";

const slug = z.string().trim().min(1).max(160);
const id = z.string().trim().min(1).max(64);

const PUBLIC = { cache: Cache.catalogue, cors: true };

/**
 * One part, everything the product page needs, optionally judged against the
 * customer's engine.
 *
 * A withdrawn part is a 404, the same as one that never existed: the shop
 * deactivates a part to stop selling it, and a product page that stayed up
 * with a price and a basket button would keep selling it until checkout
 * refused the order.
 *
 * Old slugs are not followed here. The storefront redirects a renamed part's
 * address because Google and WhatsApp hold links to it; the app never stores
 * a slug for longer than the screen showing it, so there is nothing stale to
 * rescue.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return guard(
    async () => {
      const parsed = slug.safeParse((await context.params).slug);
      if (!parsed.success) return fail("bad_request", PUBLIC);

      const engine = request.nextUrl.searchParams.get("engine");
      const engineId = engine === null ? undefined : id.safeParse(engine);
      if (engineId && !engineId.success) return fail("bad_request", PUBLIC);

      const product = await getAppProduct(parsed.data, engineId?.success ? engineId.data : undefined);
      if (!product) return fail("not_found", PUBLIC);
      return ok(product, PUBLIC);
    },
    "products/[slug]",
    PUBLIC,
  );
}

export const OPTIONS = preflight;
