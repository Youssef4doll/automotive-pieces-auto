import type { Metadata } from "next";
import Link from "next/link";
import { getSettings, publicContact } from "@/lib/settings";
import { pageMeta } from "@/lib/seo";
import PolicyPage, { PolicySection } from "@/components/PolicyPage";

export const metadata: Metadata = pageMeta({
  title: "Livraison et retours",
  description:
    "Délais et frais de livraison en Tunisie, paiement à la livraison, retrait en magasin, conditions de retour sous 14 jours et garantie 12 mois.",
  path: "/livraison-retours",
});

/**
 * What happens after "Commander", written down.
 *
 * The footer link with this label used to open WhatsApp, so the one question
 * a cash-on-delivery customer needs answered before ordering — what it costs,
 * when it comes, what happens if it is wrong — had no page. Every figure here
 * is read from the shop's own settings rather than typed into the copy, so
 * changing the delivery delay in the admin changes this page too; a policy
 * page that contradicts the checkout is worse than none.
 */
export default async function DeliveryReturnsPage() {
  const settings = await getSettings();
  const contact = publicContact(settings);
  const threshold = Number(settings.free_shipping_threshold) || 0;

  return (
    <PolicyPage
      title="Livraison et retours"
      path="/livraison-retours"
      updated="17 septembre 2026"
      contact={contact}
      intro="Ce que coûte la livraison, quand elle arrive, comment vous payez, et ce qui se passe si la pièce ne convient pas."
    >
      <PolicySection id="delais" title="Délais">
        <ul className="flex flex-col gap-1.5">
          <li>
            <strong>Grand Tunis :</strong> {settings.delivery_grand_tunis}
          </li>
          <li>
            <strong>Autres gouvernorats :</strong> {settings.delivery_regions}
          </li>
        </ul>
        <p>
          Les délais courent à partir de la confirmation de la commande, pas de la commande
          elle-même : nous vous appelons d&apos;abord pour confirmer la pièce et l&apos;adresse. Une
          pièce marquée <strong>« Disponible sur commande »</strong> n&apos;est pas en rayon — nous la
          commandons chez notre fournisseur, et le délai de livraison s&apos;ajoute au délai
          d&apos;approvisionnement.
        </p>
        <p>
          Nous n&apos;affichons pas de date de livraison précise sur les fiches produit. Annoncer un
          jour que nous ne pouvons pas tenir, sur des commandes payées en espèces à la réception,
          coûte plus cher à tout le monde qu&apos;une fourchette honnête.
        </p>
      </PolicySection>

      <PolicySection id="frais" title="Frais">
        <p>
          Les frais de livraison sont affichés dans le panier et sur la page de commande avant toute
          validation, jamais découverts à la fin.
          {threshold > 0 && (
            <>
              {" "}
              La livraison est <strong>offerte à partir de {threshold} DT</strong> de marchandise.
            </>
          )}
        </p>
        <p>
          Le <strong>droit de timbre</strong> est une taxe fiscale tunisienne d&apos;un dinar par
          commande. Il n&apos;est ajouté que si la boutique dispose d&apos;un matricule fiscal ; le cas
          échéant il apparaît dans le total avant que vous validiez.
        </p>
      </PolicySection>

      <PolicySection id="paiement" title="Paiement">
        <p>
          <strong>Paiement à la livraison, en espèces.</strong> Aucune carte bancaire n&apos;est
          demandée, aucune donnée bancaire n&apos;est saisie ni conservée sur ce site. Vous payez au
          livreur au moment où vous recevez la pièce.
        </p>
        <p>
          Préparez le montant exact affiché sur votre confirmation de commande : le livreur ne rend
          pas toujours la monnaie.
        </p>
      </PolicySection>

      <PolicySection id="retrait" title="Retrait en magasin">
        {contact.address ? (
          <p>
            Vous pouvez choisir le retrait au comptoir à la commande. Nous vous prévenons quand la
            pièce est prête. Adresse : {contact.address}
            {contact.hours && <> — {contact.hours}</>}.
          </p>
        ) : (
          <p>
            Le retrait au comptoir est proposé à la commande.{" "}
            <strong>L&apos;adresse du magasin n&apos;est pas encore publiée sur le site</strong> :
            nous vous la communiquons lors de l&apos;appel de confirmation, ou écrivez-nous depuis la{" "}
            <Link href="/contact">page contact</Link>.
          </p>
        )}
      </PolicySection>

      <PolicySection id="retours" title="Retours">
        <p>
          <strong>14 jours</strong> à compter de la réception pour nous retourner une pièce qui ne
          vous convient pas. La pièce doit être dans son état d&apos;origine : non montée, non
          rayée, dans son emballage, avec les accessoires livrés avec elle.
        </p>
        <p>
          Une pièce montée sur le véhicule ne peut plus être reprise, même si elle s&apos;avère ne pas
          convenir. C&apos;est la raison pour laquelle nous vous demandons votre véhicule avant la
          commande et pourquoi nous vérifions la compatibilité avant l&apos;expédition : il vaut mieux
          une commande refusée qu&apos;une pièce ouverte.
        </p>
        <p>
          <strong>Si l&apos;erreur vient de nous</strong> — pièce incompatible alors que vous nous
          aviez donné votre véhicule, référence différente de celle commandée, pièce abîmée à
          l&apos;arrivée — le retour et le remplacement sont à notre charge. Signalez-le-nous dans les
          48 heures avec une photo.
        </p>
        <p>
          Pour lancer un retour, contactez-nous depuis la{" "}
          <Link href="/contact">page contact</Link> en indiquant votre numéro de commande.
        </p>
      </PolicySection>

      <PolicySection id="garantie" title="Garantie">
        <p>
          <strong>12 mois</strong> sur les pièces que nous vendons, contre les défauts de
          fabrication, à compter de la date de livraison. La garantie couvre la pièce ; elle ne
          couvre ni la main-d&apos;œuvre de dépose et repose, ni les dommages causés par un montage
          incorrect, un usage sur un véhicule pour lequel la pièce n&apos;est pas prévue, ou
          l&apos;usure normale.
        </p>
        <p>
          Conservez votre document de commande : c&apos;est lui qui date le départ de la garantie.
          Vous le retrouvez à tout moment dans <Link href="/compte/commandes">vos commandes</Link>.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
