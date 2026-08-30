import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import AccountShell from "@/components/account/AccountShell";
import SupportCard from "@/components/SupportCard";

export const metadata = { title: "Aide & contact" };

/**
 * The questions customers actually ask before they ask a human. Each answer
 * ends somewhere useful rather than at a full stop, because a help page that
 * only explains is a dead end.
 */
const FAQ = [
  {
    q: "Je ne sais pas quelle pièce il me faut",
    a: "Envoyez-nous une photo de l'ancienne pièce, ou la référence inscrite dessus, avec la carte grise de votre voiture. On identifie la bonne référence pour vous.",
  },
  {
    q: "Comment savoir si une pièce va sur ma voiture ?",
    a: "Enregistrez votre véhicule : chaque fiche produit indique alors si la compatibilité est vérifiée, à confirmer, ou inconnue. Quand elle n'est pas certaine, nous le disons — et nous vérifions avec vous avant que vous ne commandiez.",
  },
  {
    q: "Et si je reçois la mauvaise pièce ?",
    a: "Contactez-nous immédiatement avec le numéro de commande. Une erreur de compatibilité de notre part est reprise, sans discussion.",
  },
  {
    q: "Quels sont les délais de livraison ?",
    a: "24h sur le Grand Tunis, 48 à 72h pour les autres régions. Le livreur vous appelle avant de passer.",
  },
  {
    q: "Comment puis-je payer ?",
    a: "Paiement à la livraison : vous réglez au moment où vous recevez la pièce, en espèces.",
  },
  {
    q: "Puis-je retirer ma commande en magasin ?",
    a: "Oui — choisissez « Retrait en magasin » au moment de commander, et la pièce vous attend au comptoir.",
  },
];

export default async function HelpPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/compte");

  const [settings, orderCount, lastOrder] = await Promise.all([
    getSettings(),
    prisma.order.count({ where: { userId: user.id } }),
    prisma.order.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { ref: true },
    }),
  ]);

  const contact = {
    whatsapp: settings.shop_whatsapp,
    phone: settings.shop_phone,
    email: settings.shop_email,
    hours: settings.shop_hours,
  };

  return (
    <AccountShell
      title="Aide & contact"
      subtitle="Une vraie personne répond, pendant les heures d'ouverture."
      count={orderCount}
    >
      <div className="grid lg:grid-cols-[1fr_320px] gap-4 [&>*]:min-w-0">
        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="font-heading font-extrabold uppercase text-navy-950 tracking-tight mb-3">
            Questions fréquentes
          </h2>
          <div className="flex flex-col divide-y divide-gray-100">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-1">
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none min-h-tap text-sm font-medium text-navy-950">
                  {f.q}
                  <span className="shrink-0 text-gray-400 transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="text-sm text-gray-600 leading-relaxed pb-3 pe-6">{f.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t flex flex-wrap gap-3">
            <Link
              href="/compte/commandes"
              className="inline-flex items-center min-h-tap px-4 rounded-lg border border-gray-300 text-navy-900 text-sm font-semibold"
            >
              Voir mes commandes
            </Link>
            <Link
              href="/"
              className="inline-flex items-center min-h-tap px-4 rounded-lg border border-gray-300 text-navy-900 text-sm font-semibold"
            >
              Chercher une pièce
            </Link>
          </div>
        </section>

        <div className="lg:sticky lg:top-32 lg:self-start">
          {/* Pre-loading the message with their most recent reference removes
              the one step people get stuck on: finding the order number. */}
          <SupportCard contact={contact} orderRef={lastOrder?.ref} />
        </div>
      </div>
    </AccountShell>
  );
}
