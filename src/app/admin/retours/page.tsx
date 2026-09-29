import Link from "next/link";
import { listReturns, openReturnCounts } from "@/lib/returns";
import { RETURN_COVER_LINE, RETURN_REASON_LABEL, RETURN_WISH_LABEL } from "@/lib/returns-labels";
import { RETURN_STATUSES, type ReturnStatus } from "@/lib/returns-rules";
import ReturnStatusBadge from "@/components/admin/ReturnStatusBadge";

export const metadata = { title: "Retours" };

const TABS: { key: "open" | "all" | ReturnStatus; label: string }[] = [
  { key: "open", label: "À traiter" },
  { key: "REQUESTED", label: "Nouvelles" },
  { key: "APPROVED", label: "Acceptées" },
  { key: "RECEIVED", label: "Reçues" },
  { key: "RESOLVED", label: "Terminées" },
  { key: "all", label: "Toutes" },
];

/**
 * Return requests from customers, open ones first. Each is answered on its
 * own page; the customer sees every answer on their order, and gets a push
 * and an e-mail for each.
 */
export default async function AdminReturnsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const raw = (await searchParams).f ?? "open";
  const filter = raw === "all" || raw === "open" || (RETURN_STATUSES as readonly string[]).includes(raw) ? (raw as "open" | "all" | ReturnStatus) : "open";
  const [rows, counts] = await Promise.all([listReturns(filter), openReturnCounts()]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Retours</h1>
        <p className="text-sm text-navy-900/50 mt-1">
          {counts.requested} à répondre · {counts.approved} en attente de la pièce · {counts.received} à régler.
          Les conditions affichées sont celles de la page « Livraison et retours » au moment de la demande.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrer">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "open" ? "/admin/retours" : `/admin/retours?f=${t.key}`}
            aria-current={filter === t.key ? "page" : undefined}
            className={`min-h-tap inline-flex items-center px-4 rounded-full text-sm font-semibold border ${
              filter === t.key ? "bg-navy-950 text-white border-navy-950" : "bg-white text-navy-900 border-navy-900/15 hover:border-navy-900/40"
            }`}
          >
            {t.label}
            {t.key === "REQUESTED" && counts.requested > 0 && (
              <span className="ms-2 rounded-full bg-red-500 text-white text-[11px] px-1.5">{counts.requested}</span>
            )}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="text-sm text-navy-900/50">Aucune demande ici.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/retours/${r.id}`}
                className="block rounded-xl border border-navy-900/10 bg-white p-4 hover:border-navy-900/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-navy-950">
                      <span className="font-mono">{r.ref}</span> · {RETURN_REASON_LABEL[r.reason]}
                    </p>
                    <p className="text-sm text-navy-900/70 mt-0.5 truncate">{r.parts.join(", ")}</p>
                    <p className="text-xs text-navy-900/50 mt-1">
                      {r.customerName} · {r.phone} · <span className="font-mono">{r.orderRef}</span> ·{" "}
                      {new Date(r.createdAt).toLocaleDateString("fr-FR")} · souhaite {RETURN_WISH_LABEL[r.wish].toLowerCase()}
                      {r.photoCount > 0 && ` · ${r.photoCount} photo${r.photoCount > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <ReturnStatusBadge status={r.status} />
                </div>
                {r.cover === "shop" && r.status === "REQUESTED" && (
                  <p className="mt-2 text-xs font-semibold text-red-600">{RETURN_COVER_LINE.shop}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
