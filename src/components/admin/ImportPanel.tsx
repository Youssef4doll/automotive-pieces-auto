"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { stageImport, applyImport, rollbackImport, discardImport, type ImportState } from "@/app/actions/import";

export type BatchRow = {
  id: string;
  filename: string;
  status: string;
  rowCount: number;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  warningCount: number;
  createdAt: string;
  preview: {
    line: number;
    sku: string;
    name: string;
    category: string;
    priceSell: number | null;
    stockQty: number;
    refCount: number;
    errors: string[];
    warnings: string[];
  }[];
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "À valider",
  APPLIED: "Appliqué",
  ROLLED_BACK: "Annulé",
  FAILED: "Échec",
};

export default function ImportPanel({ batches }: { batches: BatchRow[] }) {
  const [state, action, uploading] = useActionState<ImportState, FormData>(stageImport, undefined);
  const [msg, setMsg] = useState<ImportState>(undefined);
  // Open the batch the operator is most likely to act on: one awaiting
  // validation, otherwise the most recent. Deriving it at render is what makes
  // a freshly uploaded file show its own verdict — useState alone captured the
  // list from before the upload and left the new batch collapsed.
  const focusId = batches.find((b) => b.status === "DRAFT")?.id ?? batches[0]?.id ?? null;
  const [openId, setOpenId] = useState<string | null>(focusId);
  useEffect(() => {
    if (focusId) setOpenId(focusId);
  }, [focusId]);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<ImportState>) {
    start(async () => setMsg(await fn()));
  }

  const notice = msg ?? state;

  return (
    <div className="flex flex-col gap-5">
      {notice?.error && (
        <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{notice.error}</p>
      )}
      {notice?.ok && (
        <p className="text-sm font-medium text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{notice.ok}</p>
      )}

      <form action={action} className="rounded-xl border border-navy-900/10 bg-white p-4 flex flex-col gap-3">
        <div>
          <h2 className="font-display font-bold uppercase text-sm tracking-wide text-navy-950">Importer un fichier</h2>
          <p className="text-sm text-gray-500 mt-1">
            CSV ou texte délimité, séparateur <code>,</code> ou <code>;</code>. Rien n&apos;est écrit au catalogue tant que
            vous n&apos;avez pas validé l&apos;aperçu.
          </p>
        </div>
        <input
          type="file"
          name="file"
          accept=".csv,.txt,text/csv,text/plain"
          required
          className="text-sm file:me-3 file:px-4 file:min-h-tap file:rounded-lg file:border-0 file:bg-gold-500 file:text-navy-950 file:font-display file:font-bold file:uppercase file:text-xs file:tracking-wide file:cursor-pointer"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <button
            disabled={uploading}
            className="px-5 min-h-tap rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide disabled:opacity-60"
          >
            {uploading ? "Analyse…" : "Analyser le fichier"}
          </button>
          <span className="text-xs text-gray-500">
            Colonnes reconnues : référence, nom, catégorie, marque, prix, prix d&apos;achat, stock, OEM, équipementier,
            description, essieu, côté.
          </span>
        </div>
      </form>

      {batches.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun import pour le moment.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {batches.map((b) => {
            const open = openId === b.id;
            const errors = b.preview.filter((r) => r.errors.length > 0);
            const warned = b.preview.filter((r) => r.errors.length === 0 && r.warnings.length > 0);
            return (
              <div key={b.id} className="rounded-xl border border-navy-900/10 bg-white overflow-hidden">
                <div className="flex items-center gap-3 p-4 flex-wrap">
                  <button onClick={() => setOpenId(open ? null : b.id)} className="flex-1 min-w-0 text-start min-h-tap">
                    <p className="font-medium text-navy-950 truncate">{b.filename}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(b.createdAt).toLocaleString("fr-FR")} · {b.rowCount} ligne(s)
                    </p>
                  </button>
                  <span
                    className={`text-xs font-bold px-3 py-1.5 rounded-full shrink-0 ${
                      b.status === "APPLIED"
                        ? "bg-green-100 text-green-700"
                        : b.status === "DRAFT"
                          ? "bg-gold-500/20 text-navy-900"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </div>

                <div className="px-4 pb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                  <Stat label="à créer" value={b.createdCount} />
                  <Stat label="à mettre à jour" value={b.updatedCount} />
                  <Stat label="en erreur" value={b.errorCount} tone={b.errorCount ? "bad" : undefined} />
                  <Stat label="avertissements" value={b.warningCount} tone={b.warningCount ? "warn" : undefined} />
                </div>

                {open && (
                  <div className="border-t border-gray-100">
                    {/* Errors first: they are the rows the operator has to fix,
                        and burying them under 3 000 valid lines is useless. */}
                    {errors.length > 0 && (
                      <PreviewTable title={`${errors.length} ligne(s) rejetée(s)`} rows={errors} tone="bad" />
                    )}
                    {warned.length > 0 && (
                      <PreviewTable title={`${warned.length} ligne(s) importable(s) avec réserve`} rows={warned} tone="warn" />
                    )}
                    <PreviewTable
                      title="Aperçu"
                      rows={b.preview.filter((r) => r.errors.length === 0 && r.warnings.length === 0).slice(0, 15)}
                    />

                    <div className="p-4 flex gap-2 flex-wrap border-t border-gray-100">
                      {b.status === "DRAFT" && (
                        <>
                          <button
                            disabled={pending || b.rowCount - b.errorCount === 0}
                            onClick={() => run(() => applyImport(b.id))}
                            className="px-5 min-h-tap rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase text-xs tracking-wide disabled:opacity-50"
                          >
                            {pending ? "…" : `Importer ${b.rowCount - b.errorCount} ligne(s)`}
                          </button>
                          <button
                            disabled={pending}
                            onClick={() => run(() => discardImport(b.id))}
                            className="px-4 min-h-tap rounded-lg border border-gray-300 text-gray-600 text-xs font-semibold uppercase"
                          >
                            Supprimer le brouillon
                          </button>
                        </>
                      )}
                      {b.status === "APPLIED" && (
                        <button
                          disabled={pending}
                          onClick={() => run(() => rollbackImport(b.id))}
                          className="px-4 min-h-tap rounded-lg border border-red-300 text-red-600 text-xs font-semibold uppercase hover:bg-red-50"
                        >
                          Annuler cet import
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "bad" | "warn" }) {
  return (
    <span className={tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-gray-500"}>
      <b className="font-semibold">{value}</b> {label}
    </span>
  );
}

function PreviewTable({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: BatchRow["preview"];
  tone?: "bad" | "warn";
}) {
  if (rows.length === 0) return null;
  return (
    <div className="border-t border-gray-100">
      <p
        className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-wide ${
          tone === "bad" ? "text-red-700 bg-red-50" : tone === "warn" ? "text-amber-700 bg-amber-50" : "text-gray-500 bg-gray-50"
        }`}
      >
        {title}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed min-w-[640px]">
          <thead className="text-[11px] uppercase text-gray-400">
            <tr>
              <th className="text-start px-4 py-2 w-14">Ligne</th>
              <th className="text-start px-2 py-2 w-28">Réf.</th>
              <th className="text-start px-2 py-2">Nom</th>
              <th className="text-end px-2 py-2 w-20">Prix</th>
              <th className="text-end px-2 py-2 w-16">Stock</th>
              <th className="text-start px-4 py-2 w-64">Remarques</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.line}>
                <td className="px-4 py-2 text-gray-400 tabular-nums">{r.line}</td>
                <td className="px-2 py-2 font-mono text-xs truncate">{r.sku || "—"}</td>
                <td className="px-2 py-2 truncate">{r.name || "—"}</td>
                <td className="px-2 py-2 text-end tabular-nums">{r.priceSell ?? "—"}</td>
                <td className="px-2 py-2 text-end tabular-nums">{r.stockQty}</td>
                <td className="px-4 py-2 text-xs">
                  {r.errors.map((e) => (
                    <span key={e} className="block text-red-600">{e}</span>
                  ))}
                  {r.warnings.map((w) => (
                    <span key={w} className="block text-amber-600">{w}</span>
                  ))}
                  {r.errors.length === 0 && r.warnings.length === 0 && (
                    <span className="text-gray-400">{r.refCount} référence(s)</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
