import { getActivePromotions } from "@/lib/data/catalog";
import { Cache, guard, ok, preflight } from "../_lib/respond";

/**
 * The banners the shop is running, in the order it put them in.
 *
 * Same read as the storefront's own promo band, so the two front doors show
 * the same campaign — the shop changes it once from /admin/promotions and
 * both move. HERO first, then CAMPAIGN, which is the order the website
 * concatenates them in.
 *
 * **An empty list is the normal answer and means show nothing.** There is no
 * placeholder banner and no evergreen fallback: when the shop is not running
 * a campaign, the space belongs to the catalogue. A house ad invented here
 * to fill a gap would be exactly the kind of thing `BRIEF.md` §2 forbids.
 *
 * `imageUrl` is relative to the website, because that is where the file is
 * served from. The app makes it absolute against its own API base.
 */
const PUBLIC = { cache: Cache.catalogue, cors: true };

export async function GET() {
  return guard(
    async () => {
      const [hero, campaigns] = await Promise.all([
        getActivePromotions("HERO"),
        getActivePromotions("CAMPAIGN"),
      ]);

      const data = [
        ...hero.map((p) => ({ ...p, placement: "HERO" as const })),
        ...campaigns.map((p) => ({ ...p, placement: "CAMPAIGN" as const })),
      ].map((p) => ({
        id: p.id,
        // The shop writes this as the image's alt text, so it is a real
        // description of the banner rather than a headline — which is
        // exactly what a screen reader needs, and why it is required.
        title: p.title,
        imageUrl: p.imageUrl,
        href: p.href,
        // A code, not a label: the app writes its own French, English and
        // Arabic. Null on a hero banner.
        kind: p.kind,
        placement: p.placement,
      }));

      return ok(data, PUBLIC);
    },
    "promotions",
    PUBLIC,
  );
}

export const OPTIONS = preflight;
