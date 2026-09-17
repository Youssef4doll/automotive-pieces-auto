import type { Metadata } from "next";
import Link from "next/link";
import { getSettings, publicContact } from "@/lib/settings";
import { taxPolicy } from "@/lib/tax";
import { pageMeta } from "@/lib/seo";
import PolicyPage, { PolicySection } from "@/components/PolicyPage";

export const metadata: Metadata = pageMeta({
  title: "Conditions générales de vente",
  description:
    "Les conditions de vente d'Automotive Pièces Auto : commande, prix, paiement à la livraison, compatibilité des pièces, retours, garantie et litiges.",
  path: "/conditions",
});

/**
 * The terms, in the words the site actually operates in.
 *
 * Written to describe this shop rather than to be a template: cash on
 * delivery, a confirmation call, compatibility checked against a fitment
 * table whose limits the site already publishes at /sources. Where the law
 * would require a detail the shop has not supplied — a registered address, a
 * matricule fiscal — the page says so instead of filling it in.
 *
 * It is not a lawyer's document and does not pretend to be. The note at the
 * end says that out loud, because a shop that believes it is covered and is
 * not is worse off than one that knows it still has that job to do.
 */
export default async function TermsPage() {
  const settings = await getSettings();
  const contact = publicContact(settings);
  // The shop is VAT-registered only once it has published a matricule fiscal;
  // taxPolicy() is the same gate the receipts and the totals use.
  const taxed = taxPolicy(settings).vatRate > 0;

  return (
    <PolicyPage
      title="Conditions générales de vente"
      path="/conditions"
      updated="17 septembre 2026"
      contact={contact}
      intro="Ce à quoi vous vous engagez en commandant sur ce site, et ce à quoi nous nous engageons en retour."
    >
      <PolicySection id="objet" title="Objet">
        <p>
          Ces conditions régissent la vente de pièces détachées automobiles sur ce site à des
          clients en Tunisie. Passer une commande vaut acceptation de ces conditions dans leur
          version en ligne au moment de la commande.
        </p>
      </PolicySection>

      <PolicySection id="commande" title="La commande">
        <p>
          Une commande passée sur le site est une <strong>demande</strong>, pas encore une vente
          ferme. Nous vous appelons pour confirmer la pièce, l&apos;adresse et le montant. La vente
          est conclue à cette confirmation.
        </p>
        <p>
          Nous pouvons refuser ou annuler une commande, en vous en donnant la raison, si la pièce
          n&apos;est plus disponible, si le numéro de téléphone fourni ne permet pas de vous joindre,
          si l&apos;adresse de livraison est hors de notre zone, ou si la pièce commandée ne convient
          manifestement pas au véhicule annoncé.
        </p>
        <p>
          Vous pouvez annuler sans frais tant que la commande n&apos;a pas été expédiée. Après
          expédition, voir <Link href="/livraison-retours">les retours</Link>.
        </p>
      </PolicySection>

      <PolicySection id="prix" title="Prix">
        <p>
          Les prix sont affichés en dinars tunisiens, toutes taxes comprises.{" "}
          {taxed ? (
            <>
              La TVA est détaillée sur la facture ; elle ne s&apos;ajoute pas au prix affiché. Le
              droit de timbre, lui, est une taxe par commande et s&apos;ajoute au total : il est
              annoncé dès le panier.
            </>
          ) : (
            <>
              La boutique ne dispose pas encore d&apos;un matricule fiscal publié : aucune TVA
              n&apos;est facturée, aucun droit de timbre n&apos;est perçu, et le document remis avec
              la commande est un <strong>reçu</strong> et non une facture.
            </>
          )}
        </p>
        <p>
          Les frais de livraison sont indiqués séparément et visibles avant la validation de la
          commande. Le prix qui engage est celui affiché au moment de la confirmation.
        </p>
      </PolicySection>

      <PolicySection id="paiement" title="Paiement">
        <p>
          <strong>Paiement en espèces à la livraison.</strong> Ce site ne demande, ne traite ni ne
          conserve aucune donnée bancaire. Aucun acompte n&apos;est demandé à la commande.
        </p>
      </PolicySection>

      <PolicySection id="compatibilite" title="Compatibilité des pièces">
        <p>
          La compatibilité annoncée sur une fiche produit provient de notre table de correspondance
          véhicule/pièce. Nous expliquons d&apos;où viennent ces données, ce qui est vérifié et ce
          qui ne l&apos;est pas, sur la page <Link href="/sources">Sources et méthode</Link>.
        </p>
        <p>
          <strong>Une correspondance affichée n&apos;est pas une certitude.</strong> Les
          motorisations d&apos;un même modèle diffèrent, et un véhicule peut avoir reçu une pièce
          d&apos;un autre millésime lors d&apos;une réparation antérieure. C&apos;est pourquoi nous
          vous demandons votre véhicule et vérifions avant expédition — et pourquoi il vaut toujours
          mieux nous communiquer la référence lue sur la pièce déposée quand vous l&apos;avez.
        </p>
        <p>
          Les références d&apos;origine (OE) citées servent à identifier la pièce que la nôtre
          remplace. Elles n&apos;impliquent aucun lien commercial avec le constructeur, et les
          marques citées appartiennent à leurs propriétaires respectifs.
        </p>
      </PolicySection>

      <PolicySection id="livraison" title="Livraison, retours et garantie">
        <p>
          Les délais, les frais, les conditions de retour sous 14 jours et la garantie de 12 mois
          sont détaillés sur la page{" "}
          <Link href="/livraison-retours">Livraison et retours</Link>, qui fait partie intégrante de
          ces conditions.
        </p>
      </PolicySection>

      <PolicySection id="donnees" title="Vos données">
        <p>
          Voir <Link href="/confidentialite">Confidentialité</Link> : ce que nous collectons,
          pourquoi, combien de temps, et comment demander la suppression.
        </p>
      </PolicySection>

      <PolicySection id="litiges" title="Réclamations et litiges">
        <p>
          Écrivez-nous d&apos;abord depuis la <Link href="/contact">page contact</Link> avec votre
          numéro de commande : la très grande majorité des problèmes se règlent par un remplacement
          ou un remboursement sans que personne ait à écrire à qui que ce soit d&apos;autre.
        </p>
        <p>
          À défaut d&apos;accord, le litige relève du droit tunisien et des tribunaux compétents.
        </p>
      </PolicySection>

      <PolicySection id="reserve" title="Ce document et ses limites">
        <p>
          Ces conditions décrivent fidèlement la façon dont cette boutique fonctionne. Elles
          n&apos;ont pas été rédigées par un juriste et ne remplacent pas une relecture par un
          professionnel au regard de la réglementation tunisienne applicable au commerce
          électronique et à la protection du consommateur.{" "}
          {!taxed && (
            <>
              Les mentions légales obligatoires d&apos;un commerçant — matricule fiscal, registre du
              commerce, adresse du siège — ne sont pas encore renseignées sur ce site.
            </>
          )}
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
