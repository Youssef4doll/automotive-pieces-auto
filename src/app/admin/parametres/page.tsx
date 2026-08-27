import { getSettings } from "@/lib/settings";
import SettingsForm from "@/components/admin/SettingsForm";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ces informations s&rsquo;affichent immédiatement sur le site public (en-tête, pied de page, page produit, tunnel de commande).
        </p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
