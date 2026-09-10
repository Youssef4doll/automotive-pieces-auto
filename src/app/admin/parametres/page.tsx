import { getSettings, missingContactFields } from "@/lib/settings";
import { emailConfigured, emailTransportName } from "@/lib/email";
import SettingsForm from "@/components/admin/SettingsForm";

export const metadata = { title: "Paramètres" };

export default async function AdminSettingsPage() {
  const settings = await getSettings();
  const missing = missingContactFields(settings);
  // Sending is configured with environment variables, not with this form —
  // an API key does not belong in a table the whole site reads. But whether
  // it works is exactly the sort of thing an owner should not have to place
  // a test order to discover, so it is stated here.
  const mailOn = emailConfigured();
  const mailVia = emailTransportName();

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

      {/* Two states, both worth saying out loud. Off is the default and is
          not an error — it is a to-do with the exact variables named, so
          nobody has to read the source to find out what to set. */}
      <div
        className={`rounded-xl border px-4 py-3.5 ${
          mailOn ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"
        }`}
      >
        <p className={`text-sm font-semibold ${mailOn ? "text-green-900" : "text-amber-900"}`}>
          {mailOn ? `E-mails activés — via ${mailVia}` : "Les e-mails ne sont pas encore activés"}
        </p>
        <p className={`text-sm mt-1 ${mailOn ? "text-green-800" : "text-amber-800"}`}>
          {mailOn ? (
            <>
              Chaque commande déclenche une confirmation au client et une alerte à l&rsquo;adresse de la
              boutique ci-dessous. Un changement de statut prévient le client.
            </>
          ) : (
            <>
              Les commandes sont bien enregistrées, mais personne n&rsquo;est prévenu par e-mail : ni le client,
              ni vous. Pour activer, ajoutez <strong>EMAIL_FROM</strong> et <strong>RESEND_API_KEY</strong>{" "}
              (ou <strong>SMTP_HOST</strong>, <strong>SMTP_USER</strong>, <strong>SMTP_PASS</strong>) aux
              variables d&rsquo;environnement de l&rsquo;hébergement, puis redéployez. L&rsquo;alerte arrive sur
              l&rsquo;e-mail de la boutique renseigné ci-dessous.
            </>
          )}
        </p>
      </div>

      <SettingsForm settings={settings} />
    </div>
  );
}
