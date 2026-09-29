"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fileReturn } from "@/app/actions/returns";
import { RETURN_COVER_LINE, RETURN_REASON_LABEL, RETURN_WISH_LABEL } from "@/lib/returns-labels";
import { MAX_RETURN_PHOTOS, RETURN_WISHES, type ReasonOption, type ReturnReason, type ReturnWish } from "@/lib/returns-rules";

type Line = { orderItemId: string; name: string; sku: string; qty: number; returnable: number };

const until = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" });

/**
 * The request, in the order a customer thinks it: which part, what is wrong
 * with it, what the policy says about that (deadline, who pays, the photo),
 * what they would like, then send. Every rule shown here is the server's
 * answer for this order; it is checked again when the request arrives.
 */
export default function ReturnForm({
  orderRef,
  back,
  vehicleLabel,
  reasons,
  lines,
}: {
  orderRef: string;
  back: string;
  vehicleLabel: string | null;
  reasons: ReasonOption[];
  lines: Line[];
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.orderItemId, lines.length === 1 && l.returnable > 0 ? 1 : 0])),
  );
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [wish, setWish] = useState<ReturnWish>("EXCHANGE");
  const [note, setNote] = useState("");
  const [unmounted, setUnmounted] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const rule = reasons.find((r) => r.reason === reason) ?? null;
  const chosen = Object.values(qty).some((n) => n > 0);

  const submit = () => {
    setError(null);
    if (!chosen) return setError("Choisissez au moins une pièce à retourner.");
    if (!rule) return setError("Dites-nous ce qui ne va pas.");
    if (rule.photo === "required" && photos.length === 0) return setError("Ajoutez au moins une photo de la pièce : elle est demandée pour ce motif.");
    if (rule.unmounted && !unmounted) return setError("Confirmez que la pièce n'a pas été montée et qu'elle est dans son emballage.");
    const form = new FormData();
    form.set(
      "request",
      JSON.stringify({
        reason,
        wish,
        note: note.trim() || undefined,
        unmounted,
        items: Object.entries(qty).filter(([, n]) => n > 0).map(([orderItemId, n]) => ({ orderItemId, qty: n })),
      }),
    );
    photos.forEach((p) => form.append("photos", p));
    start(async () => {
      const result = await fileReturn(orderRef, form);
      if (!result.ok) return setError(result.error);
      router.push(`${back}?retour=${result.returnRef}#returns`);
      router.refresh();
    });
  };

  return (
    <div className="mt-6 flex flex-col gap-6">
      <section aria-labelledby="which">
        <h2 id="which" className="font-heading font-extrabold uppercase text-navy-950 tracking-tight">1. Quelle pièce ?</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {lines.map((l) => (
            <li key={l.orderItemId} className="rounded-xl border border-gray-200 bg-white p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-navy-950">{l.name}</p>
                <p className="text-xs text-gray-500 font-mono">{l.sku}</p>
                {l.returnable < l.qty && (
                  <p className="text-xs text-gray-500">{l.qty - l.returnable} déjà dans une demande en cours</p>
                )}
              </div>
              {l.returnable > 0 ? (
                <label className="flex items-center gap-2 text-sm">
                  <span className="sr-only">Quantité à retourner pour {l.name}</span>
                  <select
                    className="min-h-tap rounded-lg border border-gray-300 px-3 text-navy-950"
                    value={qty[l.orderItemId] ?? 0}
                    onChange={(e) => setQty({ ...qty, [l.orderItemId]: Number(e.target.value) })}
                  >
                    {Array.from({ length: l.returnable + 1 }, (_, n) => (
                      <option key={n} value={n}>
                        {n === 0 ? "Aucune" : n}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="text-xs text-gray-500">Déjà en retour</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <fieldset>
        <legend className="font-heading font-extrabold uppercase text-navy-950 tracking-tight">2. Que se passe-t-il ?</legend>
        <div className="mt-3 flex flex-col gap-2">
          {reasons.map((r) => (
            <label
              key={r.reason}
              className={`rounded-xl border p-3 flex gap-3 ${!r.open ? "opacity-60 border-gray-200" : reason === r.reason ? "border-navy-900 bg-navy-50" : "border-gray-200 bg-white cursor-pointer"}`}
            >
              <input type="radio" name="reason" className="mt-1" disabled={!r.open} checked={reason === r.reason} onChange={() => setReason(r.reason)} />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold text-navy-950">{RETURN_REASON_LABEL[r.reason]}</span>
                <span className="text-sm text-gray-600">
                  {r.open ? `Jusqu'au ${until(r.until)}` : "Le délai pour ce motif est passé."}
                  {r.open && r.photo === "required" && " · photo demandée"}
                </span>
                {r.open && r.cover === "shop" && (
                  <span className="text-sm font-semibold text-green-700">
                    {r.reason === "DOES_NOT_FIT" && vehicleLabel
                      ? `Vous nous aviez donné votre véhicule (${vehicleLabel}) : si la pièce ne lui va pas, le retour et le remplacement sont à notre charge.`
                      : RETURN_COVER_LINE.shop}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {rule && (
        <section aria-labelledby="details" className="flex flex-col gap-4">
          <h2 id="details" className="font-heading font-extrabold uppercase text-navy-950 tracking-tight">3. Les détails</h2>
          <p className="rounded-xl bg-navy-50 p-3 text-sm text-navy-950">{RETURN_COVER_LINE[rule.cover]}</p>

          <label className="flex flex-col gap-1 text-sm font-semibold text-navy-950">
            Photos de la pièce {rule.photo === "required" ? "(au moins une)" : "(facultatives, elles aident)"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, MAX_RETURN_PHOTOS))}
              className="text-sm font-normal"
            />
            <span className="font-normal text-gray-500">
              {photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""} choisie${photos.length > 1 ? "s" : ""}` : `Jusqu'à ${MAX_RETURN_PHOTOS}, 4 Mo chacune.`}
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-navy-950">
            En quelques mots (facultatif)
            <textarea
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 font-normal"
              placeholder="Par exemple : le connecteur n'a pas la même forme que l'ancien."
            />
          </label>

          <fieldset>
            <legend className="text-sm font-semibold text-navy-950">Vous souhaitez</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {RETURN_WISHES.map((w) => (
                <label key={w} className={`min-h-tap inline-flex items-center gap-2 rounded-xl border px-4 text-sm ${wish === w ? "border-navy-900 bg-navy-50" : "border-gray-300"}`}>
                  <input type="radio" name="wish" checked={wish === w} onChange={() => setWish(w)} />
                  {RETURN_WISH_LABEL[w]}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">La boutique vous confirme la solution en répondant à votre demande.</p>
          </fieldset>

          {rule.unmounted && (
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm text-navy-950">
              <input type="checkbox" className="mt-1" checked={unmounted} onChange={(e) => setUnmounted(e.target.checked)} />
              La pièce n&apos;a pas été montée sur le véhicule et elle est dans son emballage, avec ses accessoires.
            </label>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="min-h-tap rounded-xl bg-gold-500 px-6 font-display font-bold uppercase tracking-wide text-navy-950 disabled:opacity-50"
      >
        {pending ? "Envoi…" : "Envoyer la demande"}
      </button>
      <p className="text-xs text-gray-500">
        Rien n&apos;est remboursé ni échangé automatiquement : la boutique étudie chaque demande et vous répond sur votre commande.
      </p>
    </div>
  );
}
