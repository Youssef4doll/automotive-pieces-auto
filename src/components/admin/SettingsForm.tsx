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

      {/* Quoted on every part that is out of stock but still orderable. Left
          empty those parts say they are ordered in and say nothing about
          when — which is better than a delay nobody has committed to. */}
      <Field
        label="Délai fournisseur (pièces sur commande)"
        name="supplier_lead_time"
        defaultValue={settings.supplier_lead_time}
        placeholder="ex. 3 à 5 jours ouvrables"
      />
      <p className="-mt-2 text-xs text-gray-500">
        Affiché sur les pièces « disponibles sur commande ». Laissé vide, la fiche indique que la pièce
        est commandée chez le fournisseur sans annoncer de délai.
      </p>

      {/* The only fact on the home page that the database cannot count for
          itself. It replaced "9 ans au service des garages", which was typed
          into the site and checked against nothing. */}
      <Field
        label="Année d'ouverture (facultatif)"
        name="shop_founded_year"
        defaultValue={settings.shop_founded_year}
        type="number"
        dir="ltr"
        placeholder="ex. 2016"
      />
      <p className="-mt-2 text-xs text-gray-500">
        {yearsLabel(settings.shop_founded_year)}
      </p>

      {state?.ok && <p className="text-sm text-green-700 font-semibold">Paramètres enregistrés ✓</p>}

      <button
        disabled={pending}
        className="self-start px-5 py-3 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-display font-bold uppercase tracking-wide disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

/** Says what the home page will print, so the effect of the field is visible
 *  from the field itself rather than by saving and going to look. */
function yearsLabel(founded: string) {
  const year = Number(founded.trim());
  const now = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1900 || year > now) {
    return "Laissé vide, la page d'accueil affiche le nombre de marques au catalogue à la place.";
  }
  const years = Math.max(1, now - year);
  return `La page d'accueil affichera « ${years} ans au service des garages », recalculé chaque année.`;
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  dir,
  step,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  dir?: "ltr" | "rtl";
  placeholder?: string;
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
        placeholder={placeholder}
        className="px-3 py-2.5 border border-navy-900/15 rounded-lg text-sm outline-none focus:border-gold-500"
      />
    </label>
  );
}
