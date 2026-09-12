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
      <Field
        label="Matricule fiscal (facultatif — apparaît sur les factures)"
        name="shop_tax_id"
        defaultValue={settings.shop_tax_id}
        dir="ltr"
      />

      {/* Both are read as zero until the matricule above is filled in: a
          trader without one cannot charge la TVA and issues a reçu, not une
          facture. Said here rather than left for somebody to discover by
          typing 19 and seeing nothing change. */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Taux de TVA (%)" name="vat_rate" defaultValue={settings.vat_rate} type="number" step="any" />
        <Field label="Timbre fiscal (DT par commande)" name="stamp_duty" defaultValue={settings.stamp_duty} type="number" step="any" />
      </div>
      <p className="-mt-2 text-xs text-gray-500">
        {settings.shop_tax_id.trim()
          ? "Les prix du catalogue sont TTC : la TVA est détaillée sur la facture, elle ne s'ajoute pas au total. Le timbre fiscal, lui, s'ajoute — il est annoncé dès le panier."
          : "Sans matricule fiscal, ces deux champs restent sans effet et le document imprimable reste un reçu."}
      </p>

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
  step,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  dir?: "ltr" | "rtl";
  /** Number fields default to whole steps, which refuses "0.6" as invalid. */
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-display font-bold uppercase tracking-wide text-navy-900/45">{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        dir={dir}
        className="px-3 py-2.5 border border-navy-900/15 rounded-lg text-sm outline-none focus:border-gold-500"
      />
    </label>
  );
}
