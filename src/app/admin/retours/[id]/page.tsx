import Link from "next/link";
import { notFound } from "next/navigation";
import { adminReturnDetail } from "@/lib/returns";
import { formatTNDfr } from "@/lib/money";
import {
  RETURN_COVER_LINE,
  RETURN_METHOD_LABEL,
  RETURN_OUTCOME_LABEL,
  RETURN_REASON_LABEL,
  RETURN_WISH_LABEL,
} from "@/lib/returns-labels";
import ReturnStatusBadge from "@/components/admin/ReturnStatusBadge";
import ReturnActions from "@/components/admin/ReturnActions";

export const metadata = { title: "Demande de retour" };

const FIT_LABEL = { VERIFIED: "vérifiée pour ce véhicule", DERIVED: "déduite pour ce véhicule", UNLISTED: "non répertoriée pour ce véhicule" } as const;

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" }) : null;

/**
 * One request, with everything needed to decide it: what the customer says
 * and shows, what the order says (the car it was for, what our fitment data
 * said about each line), the policy's line for this case, and the steps
 * still open. Every answer reaches the customer — on their order, by push
 * and by e-mail — so the note field is written to them.
 */
export default async function AdminReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const r = await adminReturnDetail((await params).id);
  if (!r) notFound();

  const timeline = [
    ["Demande envoyée", r.createdAt],
    [r.status === "REFUSED" ? "Refusée" : "Acceptée", r.decidedAt],
    ["Pièce reçue", r.receivedAt],
    ["Terminée", r.resolvedAt],
    ["Annulée par le client", r.cancelledAt],
  ].filter(([, at]) => at) as [string, string][];

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href="/admin/retours" className="text-xs text-navy-900/50 hover:text-red-500">
            ← Retours
          </Link>
          <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950 mt-1">
            Retour <span className="font-mono">{r.ref}</span>
          </h1>
          <p className="text-sm text-navy-900/60 mt-1">{RETURN_REASON_LABEL[r.reason]} · souhaite {RETURN_WISH_LABEL[r.wish].toLowerCase()}</p>
        </div>
        <ReturnStatusBadge status={r.status} />
      </div>

      <section className={`rounded-xl border p-4 ${r.cover === "shop" ? "border-red-200 bg-red-50" : "border-navy-900/10 bg-white"}`}>
        <h2 className="text-xs font-bold uppercase tracking-wide text-navy-900/50">Ce que dit la politique</h2>
        <p className="mt-1 text-sm font-semibold text-navy-950">{RETURN_COVER_LINE[r.cover]}</p>
        {r.unmounted && <p className="mt-1 text-sm text-navy-900/70">Le client déclare la pièce non montée, dans son emballage.</p>}
      </section>

      <div className="grid md:grid-cols-2 gap-4 [&>*]:min-w-0">
        <section className="rounded-xl border border-navy-900/10 bg-white p-4 flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-navy-900/50">Le client</h2>
          <p className="text-sm text-navy-950 font-semibold">{r.order.customerName}</p>
          <p className="text-sm">
            <a className="underline" href={`tel:${r.order.phone.replace(/\s/g, "")}`}>
              {r.order.phone}
            </a>
            {r.order.email && <> · {r.order.email}</>}
          </p>
          {r.note ? (
            <blockquote className="mt-1 rounded-lg bg-slate-50 p-3 text-sm text-navy-900 whitespace-pre-wrap">« {r.note} »</blockquote>
          ) : (
            <p className="text-sm text-navy-900/50">Sans commentaire.</p>
          )}
        </section>

        <section className="rounded-xl border border-navy-900/10 bg-white p-4 flex flex-col gap-1.5 text-sm">
          <h2 className="text-xs font-bold uppercase tracking-wide text-navy-900/50">La commande</h2>
          <Link href={`/admin/commandes/${r.order.id}`} className="font-mono font-semibold text-navy-950 hover:text-red-500">
            {r.order.ref}
          </Link>
          <p className="text-navy-900/70">
            {r.order.deliveryMethod === "PICKUP" ? "Retrait en magasin" : [r.order.address, r.order.governorate].filter(Boolean).join(", ")}
          </p>
          <p className="text-navy-900/70">Livrée : {when(r.deliveredAt) ?? "—"}</p>
          <p className="text-navy-900/70">Véhicule : {r.order.vehicleLabel ?? "aucun donné à la commande"}</p>
        </section>
      </div>

      <section className="rounded-xl border border-navy-900/10 bg-white p-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-navy-900/50 mb-2">Pièces retournées</h2>
        <ul className="divide-y divide-navy-900/5">
          {r.lines.map((l) => (
            <li key={l.orderItemId} className="py-2 flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-navy-950">{l.name}</p>
                <p className="text-xs text-navy-900/50">
                  <span className="font-mono">{l.sku}</span>
                  {l.fit && r.order.vehicleLabel && <> · compatibilité {FIT_LABEL[l.fit]}</>}
                </p>
              </div>
              <span className="tabular-nums whitespace-nowrap">
                {l.qty} / {l.ordered} × {formatTNDfr(l.unitPrice)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-navy-900/70">
          Valeur au prix payé : <strong className="text-navy-950">{formatTNDfr(r.value)}</strong>
        </p>
      </section>

      {r.photoIds.length > 0 && (
        <section className="rounded-xl border border-navy-900/10 bg-white p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-navy-900/50 mb-2">Photos du client</h2>
          <div className="flex flex-wrap gap-2">
            {r.photoIds.map((id) => (
              <a key={id} href={`/api/admin/return-photos/${id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, uncached, admin-only bytes */}
                <img src={`/api/admin/return-photos/${id}`} alt="Photo envoyée par le client" className="h-32 w-32 rounded-lg object-cover border border-navy-900/10" />
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-navy-900/10 bg-white p-4 flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-navy-900/50">Suivi</h2>
        <ol className="flex flex-col gap-1 text-sm">
          {timeline.map(([label, at]) => (
            <li key={label} className="flex justify-between gap-3">
              <span className="text-navy-950">{label}</span>
              <span className="text-navy-900/50 tabular-nums">{when(at)}</span>
            </li>
          ))}
        </ol>
        {r.method && <p className="text-sm">Retour : <strong>{RETURN_METHOD_LABEL[r.method]}</strong></p>}
        {r.outcome && (
          <p className="text-sm">
            Solution : <strong>{RETURN_OUTCOME_LABEL[r.outcome]}</strong>
            {r.refundAmount !== null && <> — {formatTNDfr(r.refundAmount)}</>}
          </p>
        )}
        {r.restocked && <p className="text-sm text-navy-900/70">Pièces remises en stock à la réception.</p>}
        {r.shopNote && (
          <p className="text-sm">
            Message au client : <span className="text-navy-900/80">« {r.shopNote} »</span>
          </p>
        )}
      </section>

      {r.next.length > 0 && <ReturnActions id={r.id} next={r.next} value={r.value} wish={r.wish} status={r.status} />}
    </div>
  );
}
