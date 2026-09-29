import Link from "next/link";
import { returnsForOrder } from "@/lib/returns";
import { formatTNDfr } from "@/lib/money";
import { RETURN_DAYS, WARRANTY_MONTHS } from "@/lib/policy";
import {
  RETURN_COVER_LINE,
  RETURN_METHOD_LABEL,
  RETURN_OUTCOME_LABEL,
  RETURN_REASON_LABEL,
  RETURN_STATUS_LABEL,
  RETURN_WISH_LABEL,
} from "@/lib/returns-labels";
import type { ReturnStatus } from "@/lib/returns-rules";
import WithdrawReturnButton from "./WithdrawReturnButton";

const STEPS: ReturnStatus[] = ["REQUESTED", "APPROVED", "RECEIVED", "RESOLVED"];

/** What the customer should expect next — only what the shop has actually set. */
const NEXT: Partial<Record<ReturnStatus, string>> = {
  REQUESTED: "La boutique étudie votre demande et vous répond ici. Vous recevez aussi un e-mail si votre commande en porte un.",
  APPROVED: "Retour accepté. Suivez l'indication ci-dessous pour rendre la pièce, avec ce numéro de demande.",
  RECEIVED: "La pièce est arrivée au magasin. La boutique règle votre retour et vous l'indique ici.",
};

/**
 * The returns of one order, on the customer's own order page: each request
 * with where it stands and what the shop answered, and — while the order is
 * inside a window — the way to start one. Nothing appears for an order that
 * is not delivered and has no request.
 */
export default async function OrderReturnsPanel({
  orderId,
  orderRef,
  address,
  hours,
}: {
  orderId: string;
  orderRef: string;
  address: string | null;
  hours: string | null;
}) {
  const { requests, options } = await returnsForOrder(orderId);
  const anyOpen = Boolean(options?.reasons.some((r) => r.open) && options.items.some((i) => i.returnable > 0));
  if (!requests.length && !options) return null;

  return (
    <section aria-labelledby="returns" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 text-start">
      <h2 id="returns" className="font-heading font-extrabold uppercase text-navy-950 tracking-tight">
        Retours et garantie
      </h2>

      {requests.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {requests.map((r) => {
            const at = STEPS.indexOf(r.status as ReturnStatus);
            const closed = r.status === "REFUSED" || r.status === "CANCELLED";
            return (
              <li key={r.ref} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-navy-950">
                      Demande <span className="font-mono" dir="ltr">{r.ref}</span>
                    </p>
                    <p className="text-sm text-slate-600">
                      {RETURN_REASON_LABEL[r.reason]} · {r.items.map((i) => `${i.name}${i.qty > 1 ? ` × ${i.qty}` : ""}`).join(", ")}
                    </p>
                  </div>
                  <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-navy-50 text-navy-900">{RETURN_STATUS_LABEL[r.status as ReturnStatus]}</span>
                </div>

                {!closed && (
                  <ol className="mt-3 grid grid-cols-4 gap-1" aria-label="Étapes du retour">
                    {STEPS.map((s, i) => (
                      <li key={s} className="flex flex-col gap-1">
                        <span className={`h-1.5 rounded-full ${i <= at ? "bg-green-600" : "bg-slate-200"}`} />
                        <span className={`text-[11px] ${i <= at ? "text-navy-950 font-semibold" : "text-slate-400"}`}>{RETURN_STATUS_LABEL[s]}</span>
                      </li>
                    ))}
                  </ol>
                )}

                {NEXT[r.status as ReturnStatus] && <p className="mt-3 text-sm text-slate-600">{NEXT[r.status as ReturnStatus]}</p>}
                {r.status === "APPROVED" && r.method && (
                  <p className="mt-2 text-sm text-navy-950">
                    <strong>{RETURN_METHOD_LABEL[r.method]}</strong>
                    {r.method === "DROP_OFF" && address && (
                      <>
                        {" "}— {address}
                        {hours && <>, {hours}</>}
                      </>
                    )}
                  </p>
                )}
                {r.status === "RESOLVED" && r.outcome && (
                  <p className="mt-2 text-sm text-navy-950">
                    <strong>{RETURN_OUTCOME_LABEL[r.outcome]}</strong>
                    {r.outcome === "REFUNDED" && r.refundAmount !== null && <> — {formatTNDfr(r.refundAmount)}</>}
                  </p>
                )}
                {r.shopNote && (
                  <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-navy-900">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">Message de la boutique</span>« {r.shopNote} »
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  Vous souhaitiez {RETURN_WISH_LABEL[r.wish].toLowerCase()} · {RETURN_COVER_LINE[r.cover]}
                </p>
                {r.status === "REQUESTED" && <WithdrawReturnButton orderRef={orderRef} returnRef={r.ref} />}
              </li>
            );
          })}
        </ul>
      )}

      {options && (
        <div className="mt-3">
          {anyOpen ? (
            <>
              <p className="text-sm text-slate-600">
                Une pièce ne va pas, est arrivée abîmée, ou n&apos;est pas celle commandée ? Faites la demande ici :
                la boutique la reçoit avec votre commande, votre véhicule et vos photos.
              </p>
              <Link
                href={`/commande/${orderRef}/retour`}
                className="mt-3 inline-flex items-center justify-center min-h-tap px-5 rounded-xl bg-gold-500 text-navy-950 font-display font-bold uppercase text-sm tracking-wide"
              >
                Retourner une pièce
              </Link>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Les délais de retour de cette commande sont passés ({RETURN_DAYS} jours, garantie {WARRANTY_MONTHS} mois). Pour toute
              question, écrivez-nous en indiquant son numéro.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Conditions complètes : <Link className="underline" href="/livraison-retours#retours">Livraison et retours</Link>.
          </p>
        </div>
      )}
    </section>
  );
}
