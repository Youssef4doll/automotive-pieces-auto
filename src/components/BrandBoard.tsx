import { getPartsBrands } from "@/lib/data/catalog";
import BrandGrid from "./BrandGrid";
import T from "./T";

/**
 * The equipment makers the shop carries, as a board.
 *
 * This was an auto-scrolling marquee of brand names on navy. Three things
 * were wrong with it. The tiles were `<div>`s, so the one question a shopper
 * has here — "do you carry Bosch?" followed by "show me" — had no answer: it
 * was a decorative strip. The names were set in type on a dark band, where a
 * maker's mark is the recognisable thing and every one of those marks is
 * drawn for white. And it moved on its own, so reading it meant waiting for
 * the name you wanted to come back round.
 *
 * It is a still grid now, on white, every tile a link into the catalogue
 * filtered to that maker. Logos where the shop has uploaded one in
 * /admin/catalogue/marques, the name set in type where it has not — never a
 * drawn stand-in, which would be an invented maker's mark.
 *
 * The subtitle counts the brands in the catalogue. It used to read "+60
 * équipementiers distribués", which was a number nobody had counted.
 *
 * The tiles and the phone's "see all" control live in BrandGrid, which is a
 * client component because that button holds state; the query stays here on
 * the server.
 */
export default async function BrandBoard() {
  const brands = await getPartsBrands();
  if (brands.length === 0) return null;

  return (
    <section id="marques" className="border-y border-navy-900/8 bg-white py-8 sm:py-11">
      <div className="mx-auto shell-w px-4">
        <div className="mb-5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
          <h2 className="font-heading text-xl font-extrabold uppercase tracking-tight text-navy-950 sm:text-2xl">
            <T k="home.brands" />
          </h2>
          <span className="text-sm text-gray-500">
            {brands.length} <T k="home.brandsSub" />
          </span>
        </div>

        {/* Only the three fields a tile draws. The Brand row also carries the
            admin's own bookkeeping, and this is a client component's props —
            everything passed here is serialised into the page. */}
        <BrandGrid
          brands={brands.map((b) => ({ id: b.id, name: b.name, logoUrl: b.logoUrl }))}
        />
      </div>
    </section>
  );
}
