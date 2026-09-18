import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { pageMeta } from "@/lib/seo";
import Breadcrumbs from "@/components/Breadcrumbs";
import GuestOrderLookup from "@/components/GuestOrderLookup";
import { IconPackage } from "@/components/icons";

export const metadata: Metadata = pageMeta({
  title: "Suivre ma commande",
  description:
    "Suivez votre commande avec son numéro et le téléphone donné à la commande — sans compte, sans mot de passe.",
  path: "/suivi",
});

const CRUMBS = [
  { name: "Accueil", path: "/" },
  { name: "Suivre ma commande", path: "/suivi" },
];

/**
 * The way back to an order, for people who never made an account.
 *
 * The footer has said "Suivi de commande" since the shop opened and it pointed
 * at /compte/commandes, which is behind a login. Checkout does not require an
 * account or even an e-mail, so for a guest that link was a wall: their order
 * lived only in an httpOnly cookie, and clearing cookies — or ordering on
 * somebody else's phone — lost it for good.
 *
 * Signed-in customers are sent to their own list instead, because they have a
 * better page than this one.
 */
export default async function TrackOrderPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <Breadcrumbs items={CRUMBS} />

      <div className="mt-4 flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy-900">
          <IconPackage />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-extrabold uppercase tracking-tight text-navy-950 sm:text-3xl">
            Suivre ma commande
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            Pas besoin de compte. Votre numéro de commande et le téléphone que vous nous avez donné
            suffisent.
          </p>
        </div>
      </div>

      {user ? (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-700">
            Vous êtes connecté : toutes vos commandes sont déjà réunies dans votre espace, avec leur
            suivi et le bouton « Commander à nouveau ».
          </p>
          <Link
            href="/compte/commandes"
            className="mt-4 inline-flex min-h-tap items-center rounded-xl bg-navy-950 px-5 font-display text-xs font-bold uppercase tracking-wide text-white hover:bg-navy-800"
          >
            Voir mes commandes
          </Link>
        </div>
      ) : (
        <GuestOrderLookup />
      )}

      <p className="mt-6 text-sm text-gray-600">
        Vous n&apos;avez plus le numéro ?{" "}
        <Link href="/contact" className="font-semibold text-navy-900 underline underline-offset-2">
          Écrivez-nous
        </Link>{" "}
        avec votre nom et votre téléphone, nous le retrouvons.
      </p>
    </div>
  );
}
