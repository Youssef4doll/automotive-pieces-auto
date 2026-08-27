"use client";

import { useActionState } from "react";
import { updateSettingsAction, type SettingsFormState } from "@/app/actions/admin";
import type { SettingsMap } from "@/lib/settings";

export default function SettingsForm({ settings }: { settings: SettingsMap }) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(updateSettingsAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-4 max-w-xl">
      <Field label="Nom de la boutique" name="shop_name" defaultValue={settings.shop_name} />
      <Field label="Adresse" name="shop_address" defaultValue={settings.shop_address} />
      <Field label="Téléphone" name="shop_phone" defaultValue={settings.shop_phone} dir="ltr" />
      <Field label="Numéro WhatsApp (indicatif + numéro, sans +)" name="shop_whatsapp" defaultValue={settings.shop_whatsapp} dir="ltr" />
      <Field label="Email de contact" name="shop_email" defaultValue={settings.shop_email} dir="ltr" />
      <Field label="Horaires" name="shop_hours" defaultValue={settings.shop_hours} />
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Seuil livraison gratuite (DT)" name="free_shipping_threshold" defaultValue={settings.free_shipping_threshold} type="number" />
        <Field label="Délai Grand Tunis" name="delivery_grand_tunis" defaultValue={settings.delivery_grand_tunis} />
        <Field label="Délai régions" name="delivery_regions" defaultValue={settings.delivery_regions} />
      </div>

      {state?.ok && <p className="text-sm text-green-700 font-medium">Paramètres enregistrés ✓</p>}

      <button
        disabled={pending}
        className="self-start px-5 py-3 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase tracking-wide disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  dir,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-display font-bold uppercase tracking-wide text-navy-900/45">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        dir={dir}
        className="px-3 py-2.5 border border-navy-900/15 rounded-lg text-sm outline-none focus:border-gold-500"
      />
    </label>
  );
}
