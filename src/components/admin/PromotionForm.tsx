"use client";

import { useActionState } from "react";
import { upsertPromotion, type PromotionFormState } from "@/app/actions/admin";

const field = "w-full px-3 min-h-tap border border-navy-900/15 rounded-lg text-sm outline-none focus:border-gold-500";

export default function PromotionForm() {
  const [state, action, pending] = useActionState<PromotionFormState, FormData>(upsertPromotion, undefined);

  return (
    <form action={action} className="grid sm:grid-cols-2 gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-navy-900/70">Titre (texte alternatif)</span>
        <input name="title" required placeholder="Téléviseurs à partir de 385 DT" className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-navy-900/70">Image</span>
        <input name="imageUrl" required defaultValue="/images/" placeholder="/images/promo-tv.png" className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-navy-900/70">Lien (chemin interne, facultatif)</span>
        <input name="href" placeholder="/catalogue/freinage" className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-navy-900/70">Ordre</span>
        <input name="order" type="number" inputMode="numeric" defaultValue={0} className={field} />
      </label>
      <label className="flex items-center gap-2 sm:col-span-2">
        <input name="active" type="checkbox" defaultChecked className="w-5 h-5" />
        <span className="text-sm text-navy-900">Active</span>
      </label>
      {state?.error && <p className="sm:col-span-2 text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="sm:col-span-2 text-sm text-green-700">Bannière enregistrée.</p>}
      <button
        disabled={pending}
        className="sm:col-span-2 min-h-tap px-5 rounded-lg bg-navy-900 hover:bg-navy-800 disabled:opacity-60 text-white font-display font-bold uppercase tracking-wide text-sm"
      >
        {pending ? "…" : "Ajouter"}
      </button>
    </form>
  );
}
