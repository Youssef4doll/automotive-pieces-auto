import Image from "next/image";
import Link from "next/link";
import { listVehiclePages } from "@/lib/data/vehicles";

/**
 * "Which car?" as a browsable list, on the home page.
 *
 * The finder above asks the shopper to pick make → model → engine from
 * dropdowns, which is the precise path. This is the fast one: the cars the
 * catalogue actually covers, in order of how much it stocks for them, one tap
 * each. It is also the only internal route into the vehicle pages, which is
 * what turns them from a sitemap entry into part of the site.
 *
 * Ordered by real coverage and capped, so it stays a shortcut rather than
 * becoming a directory — and it disappears entirely if no vehicle has parts.
 */
export default async function VehicleShortcuts({ take = 12 }: { take?: number }) {
  const vehicles = (await listVehiclePages()).slice(0, take);
  if (vehicles.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-7 sm:py-10">
      <div className="mb-4">
        <p className="text-xs font-display font-bold uppercase tracking-wide text-red-600 mb-1">
          Acheter pour ma voiture
        </p>
        <h2 className="text-xl sm:text-3xl font-heading font-extrabold uppercase text-navy-950 tracking-tight">
          Les véhicules que nous couvrons
        </h2>
        <p className="text-sm text-gray-500 mt-1.5 max-w-prose">
          Compatibilité vérifiée sur la motorisation. Choisissez votre modèle : nous ne montrons que les
          pièces qui vont dessus.
        </p>
      </div>

      {/* Cards, at the weight of the family board above.

          These were single-line rows barely taller than a tap target, with a
          36px logo and the part count as a bare number — the two boards did
          the same job on the same page, and this one read as a footnote to the
          other. Picking your car is not a smaller decision than picking a part
          family, so it does not get a smaller control. The logo is 56px, the
          model is the loudest thing in the card, and the count says what it is
          counting. */}
      {/* The card turns a corner on a phone.

          Logo beside text is right on a wide screen and wrong on a narrow
          one: three columns on a 400px phone leaves each card about 115px,
          and a 56px logo, a gap and the padding eat all but roughly thirty of
          them. Everything then hit `truncate`, so the board read "PEU… 208 /
          REN… Cli… / VOL… Gol…" — a wall of ellipses where the make and model
          are the only two things a shopper is looking for.

          Stacked, the text gets the full width of the card instead of what is
          left over, and every name fits at every phone size. It goes back to
          side-by-side at md, where there is room for both. */}
      <div className="grid grid-cols-2 min-[480px]:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5">
        {vehicles.map((v) => (
          <Link
            key={`${v.makeSlug}/${v.modelSlug}`}
            href={`/pieces/${v.makeSlug}/${v.modelSlug}`}
            className="flex flex-col items-center text-center gap-2 p-3 md:flex-row md:text-start md:gap-3 md:p-3.5 rounded-xl border border-navy-900/12 bg-white hover:border-gold-500 hover:shadow-sm hover:-translate-y-0.5 transition"
          >
            {/* Same fixed slot whether or not the make has a logo uploaded,
                so the grid stays even as the shop fills these in one brand
                at a time — see the identical choice on the family cards. */}
            {v.makeLogoUrl ? (
              <span className="relative shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-lg overflow-hidden bg-gray-50">
                <Image src={v.makeLogoUrl} alt="" fill sizes="(max-width: 768px) 48px, 56px" className="object-contain p-1.5" />
              </span>
            ) : (
              <span className="shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-lg bg-gray-50 text-navy-900/35 font-display font-bold text-lg md:text-xl flex items-center justify-center">
                {v.makeName[0]?.toUpperCase() ?? "?"}
              </span>
            )}
            <span className="w-full min-w-0 md:flex-1 flex flex-col gap-0.5">
              {/* 12px, not 11: the project's legibility floor, and a make
                  name set below it is the small print this card exists to get
                  away from. */}
              <span className="block text-[12px] font-display font-bold uppercase tracking-wide text-navy-900/50 truncate">
                {v.makeName}
              </span>
              {/* Wrapped to two lines rather than cut. "Série 3 (E90)" is the
                  answer to "is this my car?", and half of it is not. */}
              <span className="block text-[15px] md:text-base font-semibold text-navy-950 leading-tight line-clamp-2 [overflow-wrap:anywhere]">
                {v.modelName}
              </span>
              <span className="block text-[12px] text-navy-900/50 leading-none">
                {v.productCount} pièce{v.productCount > 1 ? "s" : ""}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
