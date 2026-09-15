"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { pageSearchMisses, resolveSearchMiss } from "@/app/actions/admin";
import { Panel, StatusChip } from "@/components/admin/charts";
import { fmtInt } from "@/lib/format-analytics";

type Row = { id: string; query: string; normalized: string; count: number; lastSeenAt: string };

/**
 * What customers came for and did not find — paged, and not read until asked.
 *
 * This is the most actionable list in the admin: every line is somebody who
 * wanted to spend money here and left. It was also rendered whole on every
 * load of the analytics page, which is fine at five lines and is a wall at
 * three hundred — and every one of those rows crossed the database, the
 * server and the wire whether or not anyone scrolled to it.
 *
 * So the panel opens with the two numbers that decide whether to look at all
 * (they come free with the page's other aggregates), and the list itself is
 * fetched ten rows at a time, first page included, only once the button is
 * pressed. A shop that opens this screen to read the trend line pays nothing
 * for a list it did not want.
 *
 * Marking a line treated removes it here without refetching the page: the row
 * is gone from the shop's buying list, and making them lose their place in a
 * three-hundred-line list to prove it would be the wrong trade.
 */
export default function UnmetDemandPaged({
  totalLines,
  totalSearches,
}: {
  totalLines: number;
  totalSearches: number;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function load(next: number) {
    setError(null);
    start(async () => {
      try {
        const res = await pageSearchMisses(next);
        setRows(res.rows);
        setPage(res.page);
        setPages(res.pages);
        setPerPage(res.perPage);
      } catch {
        setError("La liste n'a pas pu être chargée. Réessayez.");
      }
    });
  }

  function markTreated(id: string) {
    start(async () => {
      await resolveSearchMiss(id);
      setRows((current) => (current ? current.filter((r) => r.id !== id) : current));
    });
  }

  return (
    <Panel
      title="Demande non satisfaite"
      hint="Ce que des clients ont cherché sans rien trouver. Chaque ligne est une vente manquée et une piste d'achat : ajoutez la pièce au catalogue, puis marquez la ligne comme traitée."
      aside={
        totalLines > 0 ? (
          <StatusChip tone="warning">
            {fmtInt(totalLines)} référence(s) · {fmtInt(totalSearches)} recherche(s)
          </StatusChip>
        ) : (
          <StatusChip tone="good">rien en attente</StatusChip>
        )
      }
    >
      {totalLines === 0 ? (
        <p className="text-sm text-navy-900/40">
          Aucune recherche infructueuse enregistrée. La liste se remplit d&apos;elle-même dès qu&apos;un client
          cherche une pièce absente du catalogue.
        </p>
      ) : rows === null ? (
        <button
          type="button"
          onClick={() => load(0)}
          disabled={pending}
          className="inline-flex min-h-tap items-center rounded-lg border border-navy-900/15 px-4 font-display text-xs font-bold uppercase tracking-wide text-navy-900 hover:border-gold-500 disabled:opacity-60"
        >
          {pending ? "Chargement…" : `Voir la liste (${fmtInt(totalLines)})`}
        </button>
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col divide-y divide-navy-900/8 p-0">
            {rows.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <span className="w-10 shrink-0 text-center">
                  <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-red-50 px-1.5 py-0.5 text-xs font-bold text-red-700">
                    {m.count}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-navy-950">« {m.query} »</span>
                  <span className="block truncate text-[12px] text-navy-900/40">
                    {m.normalized} · vu le{" "}
                    {new Date(m.lastSeenAt).toLocaleDateString("fr-TN", { day: "numeric", month: "short" })}
                  </span>
                </span>
                <Link
                  href={`/admin/stock/nouveau?name=${encodeURIComponent(m.query)}`}
                  className="inline-flex min-h-tap-compact shrink-0 items-center rounded-lg bg-navy-900 px-3 font-display text-xs font-bold uppercase tracking-wide text-white hover:bg-navy-800"
                >
                  Ajouter
                </Link>
                <button
                  type="button"
                  onClick={() => markTreated(m.id)}
                  disabled={pending}
                  className="inline-flex min-h-tap-compact shrink-0 items-center rounded-lg border border-navy-900/15 px-3 font-display text-xs font-bold uppercase tracking-wide text-navy-900/70 hover:border-navy-900/40 disabled:opacity-60"
                >
                  Traité
                </button>
              </li>
            ))}
          </ul>

          {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}

          {pages > 1 && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-navy-900/8 pt-3">
              <button
                type="button"
                onClick={() => load(page - 1)}
                disabled={pending || page === 0}
                className="inline-flex min-h-tap-compact items-center rounded-lg border border-navy-900/15 px-3 text-xs font-semibold text-navy-900 disabled:opacity-40"
              >
                ← Précédent
              </button>
              <span className="text-xs tabular-nums text-navy-900/50">
                Page {page + 1} sur {pages} · {perPage} par page
              </span>
              <button
                type="button"
                onClick={() => load(page + 1)}
                disabled={pending || page >= pages - 1}
                className="inline-flex min-h-tap-compact items-center rounded-lg border border-navy-900/15 px-3 text-xs font-semibold text-navy-900 disabled:opacity-40"
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
