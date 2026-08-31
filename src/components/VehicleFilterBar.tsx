"use client";

import Link from "next/link";
import { useVehicle } from "@/lib/vehicle-store";

export type FitGroups<T> = {
  /** Fitment data confirms these fit the selected engine. */
  fits: T[];
  /** Fitment data exists and does not include this engine. */
  doesNotFit: T[];
  /** No fitment data at all — not a claim either way. */
  unverified: T[];
};

/**
 * Split a category's products against the shopper's vehicle.
 *
 * Three groups, not two, and the distinction is the whole point. A part with
 * no fitment data is *unverified*, not incompatible — hiding it silently would
 * lose a part that may well fit, and showing it as compatible would be a claim
 * the catalogue cannot back. It gets its own labelled group instead.
 */
export function groupByFit<T extends { fitments: { engineId: string }[] }>(
  products: T[],
  engineId: string | null,
): FitGroups<T> {
  if (!engineId) return { fits: products, doesNotFit: [], unverified: [] };

  const fits: T[] = [];
  const doesNotFit: T[] = [];
  const unverified: T[] = [];
  for (const p of products) {
    if (p.fitments.length === 0) unverified.push(p);
    else if (p.fitments.some((f) => f.engineId === engineId)) fits.push(p);
    else doesNotFit.push(p);
  }
  return { fits, doesNotFit, unverified };
}

/**
 * The bar above a filtered catalogue: what the list is currently showing, and
 * how to change it.
 *
 * When no vehicle is saved it invites the shopper to pick one, because that is
 * the single action that makes every other page on the site more useful.
 */
export default function VehicleFilterBar({
  total,
  fitCount,
  unverifiedCount,
  showAll,
  onToggle,
}: {
  total: number;
  fitCount: number;
  unverifiedCount: number;
  showAll: boolean;
  onToggle: (next: boolean) => void;
}) {
  const vehicle = useVehicle((s) => s.vehicle);

  if (!vehicle) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-navy-900/12 bg-gray-50 px-4 py-3 mb-4">
        <span className="text-sm text-gray-600">
          {total} référence{total > 1 ? "s" : ""} dans cette catégorie.
        </span>
        <Link
          href="/compte/garage"
          className="inline-flex items-center min-h-tap-compact text-sm font-semibold text-navy-600 hover:text-red-600 hover:underline underline-offset-2"
        >
          Indiquez votre voiture pour ne voir que les pièces qui vont dessus →
        </Link>
      </div>
    );
  }

  const car = `${vehicle.makeName} ${vehicle.modelName}`;
  const hidden = total - fitCount - unverifiedCount;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-navy-900/12 bg-navy-50/60 px-4 py-3 mb-4">
      <p className="text-sm text-navy-950 min-w-0">
        {showAll ? (
          <>
            Toutes les références — <strong className="font-semibold">{total}</strong> au total.
            {fitCount > 0 && (
              <span className="text-gray-600"> {fitCount} compatible(s) avec votre {car}.</span>
            )}
          </>
        ) : (
          <>
            Filtré pour votre <strong className="font-semibold">{car}</strong> :{" "}
            <strong className="font-semibold">{fitCount}</strong> pièce{fitCount > 1 ? "s" : ""} compatible
            {fitCount > 1 ? "s" : ""}.
            {hidden > 0 && <span className="text-gray-600"> {hidden} non compatible(s) masquée(s).</span>}
          </>
        )}
      </p>

      <button
        type="button"
        onClick={() => onToggle(!showAll)}
        className="shrink-0 inline-flex items-center min-h-tap-compact px-3.5 rounded-full border border-navy-900/20 bg-white text-sm font-semibold text-navy-900 hover:border-navy-900 transition-colors"
      >
        {showAll ? `Ne montrer que ma ${vehicle.makeName}` : `Voir toutes les références (${total})`}
      </button>
    </div>
  );
}
