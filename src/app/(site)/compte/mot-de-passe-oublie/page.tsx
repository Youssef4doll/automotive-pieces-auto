import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { getSettings, publicContact } from "@/lib/settings";
import { emailConfigured } from "@/lib/email";
import AuthCard from "@/components/AuthCard";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export const metadata: Metadata = { title: "Mot de passe oublié" };

/**
 * "Mot de passe oublié ?" — the request form.
 *
 * Honest about its own dependency: the link goes out by e-mail, so on a shop
 * that has not configured a mail transport yet the page says so and gives
 * the shop's real contact details instead of a form that would silently
 * send nothing.
 */
export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/compte/profil");

  const settings = await getSettings();
  const contact = publicContact(settings);
  const routes = [contact.phone, contact.email].filter(Boolean) as string[];

  return (
    <AuthCard
      eyebrow="Compte client"
      title="Mot de passe oublié ?"
      sub={
        emailConfigured()
          ? "Indiquez l'adresse de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe."
          : undefined
      }
      back={{ href: "/compte", label: "Retour à la connexion" }}
    >
      {emailConfigured() ? (
        <ForgotPasswordForm />
      ) : (
        <div className="text-sm leading-relaxed text-gray-700">
          <p>
            La réinitialisation par e-mail n&apos;est pas encore activée sur cette boutique. Contactez-nous et nous réglons
            cela avec vous.
          </p>
          {routes.length > 0 && (
            <p className="mt-3 font-semibold text-navy-950">{routes.join(" · ")}</p>
          )}
        </div>
      )}
    </AuthCard>
  );
}
