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
        <h2 className="text-xl sm:text-2xl font-heading font-extrabold uppercase text-navy-950 tracking-tight">
          Les véhicules que nous couvrons
        </h2>
        <p className="text-sm text-gray-500 mt-1.5 max-w-prose">
          Compatibilité vérifiée sur la motorisation. Choisissez votre modèle : nous ne montrons que les
          pièces qui vont dessus.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {vehicles.map((v) => (
          <Link
            key={`${v.makeSlug}/${v.modelSlug}`}
            href={`/pieces/${v.makeSlug}/${v.modelSlug}`}
            className="flex items-center gap-3 min-h-tap px-3.5 rounded-xl border border-navy-900/12 bg-white hover:border-navy-900/35 transition-colors"
          >
            {/* Same fixed slot whether or not the make has a logo uploaded,
                so the grid stays even as the shop fills these in one brand
                at a time — see the identical choice on the family cards. */}
            {v.makeLogoUrl ? (
              <span className="relative shrink-0 w-9 h-9 rounded-lg overflow-hidden bg-gray-50">
                <Image src={v.makeLogoUrl} alt="" fill sizes="36px" className="object-contain p-1" />
              </span>
            ) : (
              <span className="shrink-0 w-9 h-9 rounded-lg bg-gray-100 text-gray-500 font-display font-bold text-sm flex items-center justify-center">
                {v.makeName[0]?.toUpperCase() ?? "?"}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-xs uppercase tracking-wide text-gray-600 truncate">
                {v.makeName}
              </span>
              <span className="block text-sm font-semibold text-navy-950 truncate">{v.modelName}</span>
            </span>
            <span className="text-xs text-gray-600 shrink-0">{v.productCount}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
