import Link from "next/link";
import type { Metadata } from "next";
import { findValidResetToken } from "@/lib/password-reset";
import AuthCard from "@/components/AuthCard";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await findValidResetToken(token);

  return (
    <AuthCard
      eyebrow="Compte client"
      title={row ? "Choisissez un nouveau mot de passe" : "Ce lien n'est plus valable"}
      sub={row ? `Pour le compte ${row.user.email}.` : undefined}
      back={{ href: "/compte", label: "Retour à la connexion" }}
    >
      {row ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="text-sm leading-relaxed text-gray-700">
          <p>Un lien ne sert qu&apos;une fois et pendant une heure. Celui-ci a déjà servi, a expiré, ou est incomplet.</p>
          <Link
            href="/compte/mot-de-passe-oublie"
            className="mt-4 inline-flex w-full min-h-[52px] items-center justify-center rounded-xl bg-navy-900 font-display text-sm font-bold uppercase tracking-wide text-white hover:bg-navy-800"
          >
            Demander un nouveau lien
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
