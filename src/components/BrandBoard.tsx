import Image from "next/image";
import Link from "next/link";
import { getPartsBrands } from "@/lib/data/catalog";
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
 * équipementiers distribués", which was a number nobody had counted: there
 * are nineteen.
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

        {/* Nine on a phone, all of them from 640px up.

            Nineteen tiles three across is seven rows and about 620px, on a
            home page already ten screens long — where the strip this replaced
            cost 82px. Alphabetical, so the nine a phone keeps are not a
            ranking anybody has to defend; the rest are one search away, and
            the catalogue's own brand filter lists every one of them. */}
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 lg:grid-cols-6 3xl:grid-cols-8">
          {brands.map((b, i) => (
            <li key={b.id} className={i < 9 ? "" : "hidden sm:block"}>
              {/* Search rather than a brand page: the index carries the brand
                  on every product, so this lands on everything the shop holds
                  from that maker without a route that would otherwise have to
                  be kept in step with the catalogue. */}
              <Link
                href={`/recherche?q=${encodeURIComponent(b.name)}`}
                className="flex h-[74px] items-center justify-center rounded-lg border border-navy-900/10 bg-white px-3 transition hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-sm sm:h-[82px]"
              >
                {b.logoUrl ? (
                  <span className="relative block h-10 w-full">
                    <Image src={b.logoUrl} alt={b.name} fill sizes="160px" className="object-contain" />
                  </span>
                ) : (
                  <span className="text-center font-display text-sm font-bold uppercase leading-tight text-navy-900/70">
                    {b.name}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
