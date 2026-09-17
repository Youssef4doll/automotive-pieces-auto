import type { Metadata } from "next";
import Link from "next/link";
import { getSettings, publicContact } from "@/lib/settings";
import { pageMeta } from "@/lib/seo";
import PolicyPage, { PolicySection } from "@/components/PolicyPage";

export const metadata: Metadata = pageMeta({
  title: "Confidentialité",
  description:
    "Quelles données ce site conserve, pourquoi, combien de temps, avec qui elles sont partagées et comment en demander la suppression.",
  path: "/confidentialite",
});

/**
 * What this site actually stores, listed from the schema rather than from a
 * template.
 *
 * Every row below corresponds to a real table — User, Order, Cart,
 * AnalyticsEvent, SearchMiss, NewsletterSubscriber, ContactMessage — so the
 * page can be checked against the database instead of believed. Two things it
 * deliberately does not say: it does not claim a card payment processor,
 * because there is none, and it does not claim third-party advertising
 * trackers, because the site's own Content-Security-Policy blocks them.
 */
export default async function PrivacyPage() {
  const settings = await getSettings();
  const contact = publicContact(settings);

  return (
    <PolicyPage
      title="Confidentialité"
      path="/confidentialite"
      updated="17 septembre 2026"
      contact={contact}
      intro="Ce site conserve peu de choses, et voici exactement lesquelles. Aucune donnée bancaire n'est demandée ni stockée : vous payez en espèces à la livraison."
    >
      <PolicySection id="collecte" title="Ce que nous conservons">
        <ul className="flex flex-col gap-2">
          <li>
            <strong>Quand vous commandez :</strong> votre nom, votre téléphone, votre gouvernorat,
            votre adresse de livraison si vous vous faites livrer, et éventuellement votre e-mail.
            Ce sont les informations nécessaires pour vous appeler, vous livrer et vous retrouver si
            vous nous rappelez.
          </li>
          <li>
            <strong>Si vous créez un compte :</strong> votre nom, votre e-mail, votre téléphone et
            votre mot de passe — ce dernier sous forme d&apos;empreinte chiffrée, jamais en clair,
            de sorte que personne chez nous ne peut le lire.
          </li>
          <li>
            <strong>Votre panier :</strong> conservé pour que vous le retrouviez d&apos;une visite à
            l&apos;autre, y compris avant toute création de compte.
          </li>
          <li>
            <strong>Votre véhicule</strong>, si vous l&apos;enregistrez, pour filtrer les pièces
            compatibles.
          </li>
          <li>
            <strong>Vos messages</strong> envoyés depuis la page contact, et votre e-mail si vous
            vous inscrivez à la lettre d&apos;information.
          </li>
          <li>
            <strong>Une mesure d&apos;audience interne :</strong> les pages vues et les actions
            (recherche, ajout au panier, commande) rattachées à un identifiant de session anonyme.
            Elle sert à savoir ce que les visiteurs ne trouvent pas.
          </li>
          <li>
            <strong>Les recherches sans résultat</strong>, sous forme de texte tapé et d&apos;un
            compteur. C&apos;est notre liste d&apos;achats : elle nous dit quelles pièces les clients
            cherchent et que nous n&apos;avons pas encore.
          </li>
        </ul>
      </PolicySection>

      <PolicySection id="pas" title="Ce que nous ne conservons pas">
        <ul className="flex flex-col gap-1.5">
          <li>
            Aucune donnée bancaire — numéro de carte, IBAN, rien. Le site ne comporte aucun module
            de paiement en ligne.
          </li>
          <li>Aucun traceur publicitaire tiers : la politique de sécurité du site les bloque.</li>
          <li>Aucune revente de données, à personne, dans aucune circonstance.</li>
        </ul>
      </PolicySection>

      <PolicySection id="cookies" title="Cookies">
        <p>
          Ce site n&apos;utilise pas de cookies publicitaires et n&apos;affiche donc pas de bandeau
          de consentement. Les seuls cookies déposés servent au fonctionnement :
        </p>
        <ul className="flex flex-col gap-1.5">
          <li>votre session, si vous êtes connecté ;</li>
          <li>votre panier, pour le retrouver à votre retour ;</li>
          <li>votre langue et le véhicule que vous avez choisi ;</li>
          <li>un identifiant de session anonyme pour la mesure d&apos;audience interne.</li>
        </ul>
      </PolicySection>

      <PolicySection id="partage" title="Avec qui c'est partagé">
        <ul className="flex flex-col gap-1.5">
          <li>
            <strong>Le livreur</strong> reçoit ce qu&apos;il lui faut pour livrer : votre nom, votre
            téléphone et votre adresse.
          </li>
          <li>
            <strong>L&apos;hébergeur du site et la base de données</strong>, qui stockent
            techniquement ces informations pour notre compte.
          </li>
          <li>
            <strong>Le service qui envoie nos e-mails</strong> de confirmation de commande, lorsque
            vous nous avez donné une adresse.
          </li>
          <li>
            <strong>L&apos;administration</strong>, si la loi nous l&apos;impose.
          </li>
        </ul>
      </PolicySection>

      <PolicySection id="duree" title="Combien de temps">
        <p>
          Les commandes et les documents comptables sont conservés le temps imposé par les
          obligations comptables et fiscales. Un compte client est conservé tant que vous le gardez
          ouvert. Les paniers abandonnés, les mesures d&apos;audience et les recherches sans résultat
          sont conservés pour l&apos;analyse du catalogue et n&apos;ont pas vocation à être gardés
          indéfiniment.
        </p>
      </PolicySection>

      <PolicySection id="droits" title="Vos droits">
        <p>
          Vous pouvez demander à consulter, corriger ou supprimer vos données. Écrivez-nous depuis la{" "}
          <Link href="/contact">page contact</Link>
          {contact.email && (
            <>
              {" "}
              ou à{" "}
              <a href={`mailto:${contact.email}`} className="break-all">
                {contact.email}
              </a>
            </>
          )}
          . Vous pouvez déjà modifier vous-même votre nom, votre e-mail, votre téléphone et vos
          véhicules depuis <Link href="/compte/profil">votre profil</Link>.
        </p>
        <p>
          La suppression d&apos;un compte n&apos;efface pas les commandes déjà livrées : elles sont
          des pièces comptables que nous sommes tenus de conserver.
        </p>
      </PolicySection>

      <PolicySection id="reserve" title="Ce document et ses limites">
        <p>
          Cette page décrit fidèlement ce que le site fait aujourd&apos;hui. Elle n&apos;a pas été
          rédigée par un juriste et ne remplace pas une relecture au regard de la loi tunisienne
          relative à la protection des données à caractère personnel.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
