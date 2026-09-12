import Image from "next/image";
import Link from "next/link";
import { listVehicleMakePages } from "@/lib/data/vehicles";

/**
 * "Which car?" as a browsable board, on the home page.
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
 * Clio, and the make page one tap on is where that gets settled. It is also
 * how the big parts catalogues lay this board out, and a maker's mark is
 * recognised across a screen in a way a model name is not.
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

      {/* Six across on a laptop, eight on a wide screen — a mark is a square,
          so these want more columns and less height than the model cards they
          replaced, which carried two lines of text each.

          The logo slot is the same size whether or not the make has a logo
          uploaded, so the board stays even as the shop fills them in one at a
          time. The stand-in is the make's initial, never a drawn badge: an
          invented one would be a claim about a manufacturer. */}
      <ul className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 3xl:grid-cols-8 gap-2 sm:gap-2.5">
        {makes.map((m) => (
          <li key={m.slug}>
            <Link
              href={`/pieces/${m.slug}`}
              className="flex h-full flex-col items-center gap-2 rounded-xl border border-navy-900/12 bg-white p-3 text-center transition hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-sm sm:p-3.5"
            >
              {m.logoUrl ? (
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-50 sm:h-14 sm:w-14">
                  <Image src={m.logoUrl} alt="" fill sizes="56px" className="object-contain p-1.5" />
                </span>
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-50 font-display text-lg font-bold text-navy-900/35 sm:h-14 sm:w-14 sm:text-xl">
                  {m.name[0]?.toUpperCase() ?? "?"}
                </span>
              )}
              <span className="flex w-full min-w-0 flex-col gap-0.5">
                <span className="block text-[15px] font-semibold leading-tight text-navy-950 [overflow-wrap:anywhere]">
                  {m.name}
                </span>
                {/* Counted from the fitment table, like everything else on this
                    page. "6 modèles" is what a shopper is deciding with; the
                    part count is the same fifty-odd for every make the shop
                    covers and would read as noise. */}
                <span className="block text-[12px] leading-none text-navy-900/50">
                  {m.modelCount} modèle{m.modelCount > 1 ? "s" : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
