"use client";

import Link from "next/link";
import { useVehicle } from "@/lib/vehicle-store";
import { IconSearch, IconArrowRight } from "./icons";

export type CategoryChip = { name: string; slug: string };

/**
 * The bridge the account was missing: vehicle → category → product.
 *
 * The categories are the real stocked families passed in from the server, not
 * a hardcoded wish list, so this never sends a customer to an empty page. The
 * heading names their car only when one is actually saved.
 */
export default function ShopForCar({ categories }: { categories: CategoryChip[] }) {
  const vehicle = useVehicle((s) => s.vehicle);
  if (categories.length === 0) return null;

  return (
    <section
      aria-labelledby="shop-for-car"
      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <h2 id="shop-for-car" className="font-heading font-extrabold uppercase tracking-tight text-navy-950">
        {vehicle ? `Que cherchez-vous pour votre ${vehicle.makeName} ${vehicle.modelName} ?` : "Que cherchez-vous ?"}
      </h2>
      <p className="text-sm text-slate-500 mt-0.5">
        {vehicle
          ? "Nous signalons la compatibilité sur chaque pièce."
          : "Enregistrez votre voiture pour ne voir que les pièces qui vont dessus."}
      </p>

      <Link
        href="/recherche"
        className="mt-4 flex items-center gap-3 min-h-tap px-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
      >
        <IconSearch className="text-slate-400" />
        <span className="text-sm text-slate-500">Rechercher une pièce ou une référence</span>
      </Link>

      <ul className="flex flex-wrap gap-2 mt-4">
        {categories.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/catalogue/${c.slug}`}
              className="inline-flex items-center min-h-tap-compact px-3.5 rounded-full border border-slate-300 bg-white text-sm text-slate-700 hover:border-navy-700 hover:text-navy-950 transition-colors"
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 min-h-tap-compact mt-4 text-sm font-semibold text-navy-900 hover:text-red-600"
      >
        Voir tout le catalogue <IconArrowRight className="w-4 h-4" />
      </Link>
    </section>
  );
}
