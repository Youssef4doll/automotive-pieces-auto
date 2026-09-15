import Image from "next/image";
import Link from "next/link";
import { listVehicleMakePages } from "@/lib/data/vehicles";

/**
 * "Which car?" as a board of manufacturer marks, on the home page.
 *
 * The finder above asks the shopper to pick make → model → engine from
 * dropdowns, which is the precise path. This is the fast one: the makes the
 * catalogue actually covers, one tap each into that make's models. It is also
 * the only internal route into the vehicle pages, which is what turns them
 * from a sitemap entry into part of the site.
 *
 * **Makes, not models.** It listed make+model pairs — "Peugeot 208", "Renault
 * Clio IV" — which is a more precise answer to a question nobody starts with:
 * somebody arrives knowing they drive a Renault long before they can say which
 * Clio, and the make page one tap on is where that gets settled.
 *
 * **The mark, and nothing else.** The tile carried the make's name under the
 * logo and a "3 modèles" line under that, so a board whose whole job is
 * "find your badge" was two thirds text. A manufacturer's mark is designed to
 * be recognised across a car park; setting its name beneath it in 15px is
 * redundant to anyone who can see the logo and no help to anyone who cannot.
 * The name is still the image's `alt`, so it is what a screen reader announces
 * and what the link is called — it is removed from the picture, not from the
 * page. The model count moves to the make's own page, where it is next to the
 * models it counts.
 *
 * The name in type stays as the fallback for a make with no logo uploaded
 * yet. That is not the same thing as a caption: it is the only label the tile
 * has, and a board of anonymous empty boxes would be unusable. Never a drawn
 * stand-in, which would be an invented manufacturer's badge.
 *
 * Ordered by how deeply the shop covers each make, and it disappears entirely
 * if no vehicle has parts.
 */
export default async function VehicleShortcuts({ take = 18 }: { take?: number }) {
  const makes = (await listVehicleMakePages()).slice(0, take);
  if (makes.length === 0) return null;

  return (
    <section className="mx-auto shell-w px-4 py-7 sm:py-10">
      <div className="mb-4">
        <p className="text-xs font-display font-bold uppercase tracking-wide text-red-600 mb-1">
          Acheter pour ma voiture
        </p>
        <h2 className="text-xl sm:text-3xl font-heading font-extrabold uppercase text-navy-950 tracking-tight">
          Les marques de véhicules
        </h2>
        <p className="text-sm text-gray-500 mt-1.5 max-w-prose">
          Compatibilité vérifiée sur la motorisation. Choisissez votre marque, puis votre modèle : nous ne
          montrons que les pièces qui vont dessus.
        </p>
      </div>

      {/* The same rhythm as the parts-brand board below it — three across on a
          phone, eight on a wide screen. Two boards of manufacturer marks on one
          page that stepped at different widths read as two unrelated
          components. */}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 lg:grid-cols-6 3xl:grid-cols-8">
        {makes.map((m) => (
          <li key={m.slug}>
            <Link
              href={`/pieces/${m.slug}`}
              className="flex h-[92px] items-center justify-center rounded-xl border border-navy-900/10 bg-white px-3 transition hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-sm sm:h-[104px]"
            >
              {m.logoUrl ? (
                <span className="relative block h-14 w-full sm:h-16">
                  {/* The real slot at each breakpoint, not the widest one. A
                      single `160px` here would have a 3× phone asking the
                      optimiser for a 640px rendition of a badge it draws at
                      ninety — the mistake the parts-brand board was making
                      until it was measured. No `vw` values, so Next keeps its
                      full candidate list instead of flooring it. */}
                  <Image
                    src={m.logoUrl}
                    alt={m.name}
                    fill
                    sizes="(max-width: 639px) 104px, (max-width: 1023px) 136px, 168px"
                    className="object-contain"
                  />
                </span>
              ) : (
                <span className="text-center font-display text-sm font-bold uppercase leading-tight text-navy-900/70 [overflow-wrap:anywhere]">
                  {m.name}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
