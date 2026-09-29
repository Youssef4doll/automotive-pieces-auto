"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminMoveReturn } from "@/app/actions/returns";
import type { ReturnMove } from "@/lib/returns";
import type { ReturnStatus, ReturnWish } from "@/lib/returns-rules";

const field = "w-full rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm text-navy-950 focus:border-navy-700 focus:outline-none";
const primary =
  "min-h-tap inline-flex items-center justify-center px-5 rounded-xl bg-gold-500 text-navy-950 font-display font-bold uppercase text-sm tracking-wide disabled:opacity-50";
const secondary =
  "min-h-tap inline-flex items-center justify-center px-5 rounded-xl border border-navy-900/20 text-navy-950 font-display font-bold uppercase text-sm tracking-wide disabled:opacity-50";

/**
 * The shop's answer to a request, one step at a time. Whatever is written in
 * "Message au client" is shown to the customer on their order and sent to
 * them — it is written to them, not about them.
 */
export default function ReturnActions({
  id,
  next,
  value,
  wish,
  status,
}: {
  id: string;
  next: ReturnStatus[];
  value: number;
  wish: ReturnWish;
  status: ReturnStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<"DROP_OFF" | "PICKUP">("DROP_OFF");
  const [note, setNote] = useState("");
  const [refuseNote, setRefuseNote] = useState("");
  const [restock, setRestock] = useState(false);
  const [outcome, setOutcome] = useState<"EXCHANGED" | "REFUNDED">(wish === "REFUND" ? "REFUNDED" : "EXCHANGED");
  const [amount, setAmount] = useState(value.toFixed(2));

  const send = (move: ReturnMove) =>
    start(async () => {
      setError(null);
      const result = await adminMoveReturn(id, move);
      if (!result.ok) setError(result.error);
      else {
        setNote("");
        setRefuseNote("");
        router.refresh();
      }
    });

  return (
    <section className="rounded-xl border-2 border-navy-950 bg-white p-4 flex flex-col gap-4" aria-label="Répondre">
      <h2 className="font-heading font-extrabold uppercase text-navy-950">Répondre</h2>

      {next.includes("APPROVED") && (
        <div className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold text-navy-950 mb-1">Accepter — comment la pièce revient</legend>
            {(["DROP_OFF", "PICKUP"] as const).map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm min-h-tap">
                <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} />
                {m === "DROP_OFF" ? "Le client la dépose au magasin" : "Nous la récupérons chez le client"}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-sm">
            Message au client (facultatif)
            <textarea className={field} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Par exemple : passez du lundi au samedi, 8h–18h." />
          </label>
          <div>
            <button type="button" className={primary} disabled={pending} onClick={() => send({ to: "APPROVED", method, shopNote: note || undefined })}>
              Accepter le retour
            </button>
          </div>
        </div>
      )}

      {next.includes("RECEIVED") && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-navy-950">La pièce est arrivée au magasin</p>
          <label className="flex items-center gap-2 text-sm min-h-tap">
            <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
            Remettre en stock (pièce vérifiée, revendable)
          </label>
          <div>
            <button type="button" className={primary} disabled={pending} onClick={() => send({ to: "RECEIVED", restock })}>
              Pièce reçue
            </button>
          </div>
        </div>
      )}

      {next.includes("RESOLVED") && (
        <div className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold text-navy-950 mb-1">Régler le retour</legend>
            <label className="flex items-center gap-2 text-sm min-h-tap">
              <input type="radio" name="outcome" checked={outcome === "EXCHANGED"} onChange={() => setOutcome("EXCHANGED")} /> Pièce échangée
            </label>
            <label className="flex items-center gap-2 text-sm min-h-tap">
              <input type="radio" name="outcome" checked={outcome === "REFUNDED"} onChange={() => setOutcome("REFUNDED")} /> Remboursée
            </label>
          </fieldset>
          {outcome === "REFUNDED" && (
            <label className="flex flex-col gap-1 text-sm max-w-xs">
              Montant remboursé (DT)
              <input className={field} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <span className="text-xs text-navy-900/50">Valeur au prix payé : {value.toFixed(2).replace(".", ",")} DT</span>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            Message au client (facultatif)
            <textarea className={field} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div>
            <button
              type="button"
              className={primary}
              disabled={pending}
              onClick={() => {
                const refund = Number(amount.replace(",", "."));
                if (outcome === "REFUNDED" && !(refund >= 0)) return setError("Indiquez le montant remboursé.");
                send({ to: "RESOLVED", outcome, refundAmount: outcome === "REFUNDED" ? refund : undefined, shopNote: note || undefined });
              }}
            >
              Terminer le retour
            </button>
          </div>
        </div>
      )}

      {next.includes("REFUSED") && (
        <div className="flex flex-col gap-3 border-t border-navy-900/10 pt-4">
          <label className="flex flex-col gap-1 text-sm">
            {status === "APPROVED" ? "Refuser à la réception — pourquoi (le client le lira)" : "Refuser — pourquoi (le client le lira)"}
            <textarea className={field} rows={2} maxLength={1000} value={refuseNote} onChange={(e) => setRefuseNote(e.target.value)} placeholder="Par exemple : la pièce a été montée, elle ne peut plus être reprise." />
          </label>
          <div>
            <button type="button" className={secondary} disabled={pending || refuseNote.trim().length < 3} onClick={() => send({ to: "REFUSED", shopNote: refuseNote })}>
              Refuser la demande
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
