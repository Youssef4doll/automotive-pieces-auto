import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { getOrderCounts, contactFrom } from "@/lib/data/account";
import AccountShell from "@/components/account/AccountShell";
import HelpCenter, { type Faq } from "@/components/account/HelpCenter";

export const metadata = { title: "Aide & contact" };

/**
 * Answers describe how this shop actually works — cash on delivery, 24h Grand
 * Tunis, in-store pickup. Nothing here promises a policy the business has not
 * committed to.
 */
const FAQS: Faq[] = [
  {
    cat: "Trouver une pièce",
    q: "Je ne sais pas quelle pièce il me faut",
    a: "Envoyez-nous une photo de l'ancienne pièce, ou la référence inscrite dessus, avec la carte grise de votre voiture. On identifie la bonne référence pour vous.",
  },
  {
    cat: "Trouver une pièce",
    q: "Puis-je chercher par référence constructeur ?",
    a: "Oui. Tapez la référence dans la barre de recherche, avec ou sans espaces ni tirets : « GDB 1330 », « gdb-1330 » et « GDB1330 » donnent le même résultat.",
  },
  {
    cat: "Compatibilité",
    q: "Comment savoir si une pièce va sur ma voiture ?",
    a: "Enregistrez votre véhicule dans Mon garage. Chaque fiche produit indique alors si la compatibilité est vérifiée, à confirmer, ou encore inconnue. Quand elle n'est pas certaine, nous le disons — et nous vérifions avec vous avant que vous ne commandiez.",
  },
  {
    cat: "Commande",
    q: "Où en est ma commande ?",
    a: "Dans Mes commandes : chaque étape franchie est horodatée, de la confirmation à la livraison, et la commande en cours apparaît en haut de votre espace.",
  },
  {
    cat: "Retour & échange",
    q: "Et si je reçois la mauvaise pièce ?",
    a: "Contactez-nous immédiatement avec votre numéro de commande. Une erreur de compatibilité de notre part est reprise, sans discussion.",
  },
  {
    cat: "Livraison",
    q: "Quels sont les délais de livraison ?",
    a: "24h sur le Grand Tunis, 48 à 72h pour les autres régions. Le livreur vous appelle avant de passer.",
  },
  {
    cat: "Paiement",
    q: "Comment puis-je payer ?",
    a: "Paiement à la livraison : vous réglez au moment où vous recevez la pièce, en espèces.",
  },
  {
    cat: "Livraison",
    q: "Puis-je retirer ma commande en magasin ?",
    a: "Oui — choisissez « Retrait en magasin » au moment de commander, et la pièce vous attend au comptoir.",
  },
];

export default async function HelpPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/compte");

  const [settings, counts, lastOrder] = await Promise.all([
    getSettings(),
    getOrderCounts(user.id),
    prisma.order.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { ref: true },
    }),
  ]);
  const contact = contactFrom(settings);

  return (
    <AccountShell
      title="Comment pouvons-nous vous aider ?"
      subtitle={`Une vraie personne vous répond. ${contact.hours}`}
      user={{ name: user.name, email: user.email, role: user.role }}
      orderCount={counts.total}
      activeOrders={counts.active}
      whatsapp={contact.whatsapp}
    >
      <HelpCenter faqs={FAQS} whatsapp={contact.whatsapp} orderRef={lastOrder?.ref} />
    </AccountShell>
  );
}
