"use client";

import { useTransition } from "react";
import Link from "next/link";
import { resolveSearchMiss } from "@/app/actions/admin";

export type Miss = {
  id: string;
  query: string;
  normalized: string;
  count: number;
  lastSeenAt: Date;
};

/**
 * What customers came for and did not find.
 *
 * This is the most actionable list in the admin, so it sits above the charts:
 * every line is a person who wanted to spend money here and left. Sorted by
 * how many asked, not by when — one part wanted nineteen times is a purchase
 * order, nineteen parts wanted once each are a curiosity.
 */
export default function UnmetDemand({ misses }: { misses: Miss[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="p-5 rounded-xl bg-white border border-navy-900/10 border-l-4 border-l-red-500 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-display font-bold uppercase tracking-wide text-sm text-navy-950">
          Demande non satisfaite
        </h2>
        {misses.length > 0 && (
          <span className="text-xs text-navy-900/45">
            {misses.reduce((n, m) => n + m.count, 0)} recherche(s) sans résultat
          </span>
        )}
      </div>
      <p className="text-xs text-navy-900/45 mb-4 max-w-2xl">
        Ce que des clients ont cherché sans rien trouver. Chaque ligne est une vente manquée et une piste
        d&rsquo;achat : ajoutez la pièce au catalogue, puis marquez la ligne comme traitée.
      </p>

      {misses.length === 0 ? (
        <p className="text-sm text-navy-900/40">
          Aucune recherche infructueuse enregistrée. Elle se remplit d&rsquo;elle-même dès qu&rsquo;un client
          cherche une pièce absente du catalogue.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-navy-900/8">
          {misses.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2.5">
              <span className="w-10 shrink-0 text-center">
                <span className="inline-flex items-center justify-center min-w-7 px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-bold">
                  {m.count}
                </span>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-navy-950 truncate">« {m.query} »</span>
                <span className="block text-[11px] text-navy-900/40 truncate">
                  {m.normalized} · vu le{" "}
                  {new Date(m.lastSeenAt).toLocaleDateString("fr-TN", { day: "numeric", month: "short" })}
                </span>
              </span>
              <Link
                href={`/admin/stock/nouveau?name=${encodeURIComponent(m.query)}`}
                className="shrink-0 inline-flex items-center min-h-tap-compact px-3 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-xs font-display font-bold uppercase tracking-wide"
              >
                Ajouter
              </Link>
              <button
                disabled={pending}
                onClick={() => startTransition(() => void resolveSearchMiss(m.id))}
                className="shrink-0 inline-flex items-center min-h-tap-compact px-3 rounded-lg border border-navy-900/15 text-navy-900/60 hover:text-navy-950 text-xs font-display font-bold uppercase tracking-wide disabled:opacity-50"
              >
                Traité
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
