"use client";

import { useActionState, useRef, useState } from "react";
import { createPromoCode, type PromoCodeFormState } from "@/app/actions/promo-codes";

const field = "w-full px-3 min-h-tap border border-navy-900/15 rounded-lg text-sm outline-none focus:border-gold-500";
const label = "flex flex-col gap-1 text-xs font-semibold text-navy-900/60";

/** A new promo code. Codes are not edited after creation — see actions/promo-codes. */
export default function PromoCodeForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<"PERCENT" | "AMOUNT">("PERCENT");
  const [state, action, pending] = useActionState<PromoCodeFormState, FormData>(async (prev, formData) => {
    const result = await createPromoCode(prev, formData);
    if (result?.ok) formRef.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-2">
      <label className={label}>
        Code
        <input name="code" required maxLength={24} placeholder="ETE10" className={`${field} uppercase font-mono`} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={label}>
          Type
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as "PERCENT" | "AMOUNT")} className={field}>
            <option value="PERCENT">Pourcentage</option>
            <option value="AMOUNT">Montant (DT)</option>
          </select>
        </label>
        <label className={label}>
          {kind === "PERCENT" ? "Remise (%)" : "Remise (DT)"}
          <input name="value" required inputMode="decimal" placeholder={kind === "PERCENT" ? "10" : "15"} className={field} />
        </label>
      </div>
      <label className={label}>
        Panier minimum (DT, facultatif)
        <input name="minSubtotal" inputMode="decimal" placeholder="100" className={field} />
      </label>
      <label className={label}>
        Utilisations au total (facultatif)
        <input name="maxUses" inputMode="numeric" placeholder="50" className={field} />
      </label>
      <label className={label}>
        Valable à partir du (facultatif)
        <input name="startsAt" type="date" className={field} />
      </label>
      <label className={label}>
        Jusqu&rsquo;au (facultatif)
        <input name="endsAt" type="date" className={field} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Note interne (facultatif)
        <input name="note" maxLength={200} placeholder="Publication Facebook de septembre" className={field} />
      </label>
      <p className="sm:col-span-2 text-xs text-navy-900/45">
        La remise s&rsquo;applique aux pièces, avant la livraison. Le client ne voit jamais la note. Un code ne se modifie
        plus une fois créé : désactivez-le et créez-en un autre.
      </p>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button type="submit" disabled={pending} className="px-4 min-h-tap rounded-lg bg-navy-900 text-white text-sm font-semibold disabled:opacity-50">
          {pending ? "Création…" : "Créer le code"}
        </button>
        {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green-700">{state.ok}</p>}
      </div>
    </form>
  );
}
