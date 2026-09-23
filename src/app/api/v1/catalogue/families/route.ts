import { getMegaMenu } from "@/lib/data/catalog";
import { Cache, guard, ok, preflight } from "../../_lib/respond";

/**
 * The part families, and the subcategories under them.
 *
 * This is the catalogue's top level — what the app's "Toutes les familles de
 * pièces" screen is built from. It reuses `getMegaMenu`, which is the same
 * read the website's own header and home board use, so the two front doors
 * cannot end up listing different catalogues.
 *
 * Note which way the filtering goes here, because it is the opposite of the
 * vehicle picker's and both are right.
 *
 * The picker returns every make the shop has vehicle data for, empty ones
 * included, because hiding the ones with no parts would leave a customer
 * unable to say what they drive.
 *
 * This returns only families that actually hold a part. A tile that opens
 * onto an empty page is a dead end, and the website measured it: showing
 * every branch of the taxonomy sent 77% of taps to a page with nothing on it,
 * which reads as an abandoned shop rather than a young one. Families reappear
 * on their own the moment they hold a product, so nothing has to be
 * maintained for this to stay true.
 *
 * `productCount` is the family's own parts plus everything in its
 * subcategories. It tells the customer whether a tile is worth opening, and
 * it is counted from the catalogue rather than rounded up.
 */
export async function GET() {
  return guard(
    async () => {
      const families = await getMegaMenu();

      // Only the fields a tile and its detail screen draw. The mega menu rows
      // carry Prisma's whole category record, and shipping that to a phone
      // would send internal ordering, timestamps and parent ids to every
      // customer who opens the catalogue.
      const data = families.map((family) => ({
        id: family.id,
        name: family.name,
        slug: family.slug,
        productCount: family.productCount,
        // The picture the shop uploaded for this family in /admin/catalogue,
        // or null. With none, the app shows the same drawing the website
        // serves at /api/part-icon/<slug>.svg — one set of pictures, managed
        // in one admin, for both front doors.
        imageUrl: family.imageUrl ?? null,
        subcategories: family.children.map((child) => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          productCount: child._count.products,
          imageUrl: child.imageUrl ?? null,
        })),
      }));

      return ok(data, PUBLIC);
    },
    "catalogue/families",
    PUBLIC,
  );
}

const PUBLIC = { cache: Cache.catalogue, cors: true };

export const OPTIONS = preflight;
