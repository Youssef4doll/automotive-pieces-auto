import { getSettings, missingContactFields } from "@/lib/settings";
import SettingsForm from "@/components/admin/SettingsForm";

export const metadata = { title: "Paramètres" };

export default async function AdminSettingsPage() {
  const settings = await getSettings();
  const missing = missingContactFields(settings);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ces informations s&rsquo;affichent immédiatement sur le site public (en-tête, pied de page, page produit, tunnel de commande).
        </p>
      </div>

      {/* The storefront hides a detail it does not have rather than printing a
          placeholder at customers, so the only place this can be noticed is
          here. Naming the missing fields is the whole point of the warning. */}
      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5">
          <p className="text-sm font-semibold text-amber-900">
            {missing.length === 1
              ? "Une information de contact n’est pas encore renseignée"
              : `${missing.length} informations de contact ne sont pas encore renseignées`}
          </p>
          <p className="text-sm text-amber-800 mt-1">
            Tant qu’elles sont vides, le site public masque simplement la ligne concernée — aucun faux numéro
            n’est affiché. Champs à compléter : <strong>{missing.join(", ")}</strong>.
          </p>
        </div>
      )}

      <SettingsForm settings={settings} />
    </div>
  );
}
