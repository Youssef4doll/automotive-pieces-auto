import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSettings, publicContact } from "@/lib/settings";
import { contactLink, contactLinkProps } from "@/lib/contact-link";
import { pageMeta } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import Breadcrumbs from "@/components/Breadcrumbs";
import { breadcrumbSchema } from "@/lib/schema";

export const metadata: Metadata = pageMeta({
  title: "Sources et méthode",
  description:
    "D'où viennent les références, les prix et les données de compatibilité de notre catalogue, comment nous les vérifions, et ce que nous ne garantissons pas.",
  path: "/sources",
});

const CRUMBS = [
  { name: "Accueil", path: "/" },
  { name: "Sources et méthode", path: "/sources" },
];

/**
 * Where the catalogue's data comes from.
 *
 * In this trade the question behind every purchase is "will this actually fit
 * my car?", and the answer depends on data whose provenance the customer cannot
 * see. This page shows it: what is imported from supplier files, what is
 * verified, what is merely not contradicted, and what is not claimed at all.
 *
 * The numbers are counted at request time. A page about honesty that quotes a
 * figure typed in once and never updated would be the wrong page.
 */
export default async function SourcesPage() {
  const [settings, productCount, withFitment, withOem, withPhotos, brandCount, lastImport] =
    await Promise.all([
      getSettings(),
      prisma.product.count({ where: { active: true } }),
      prisma.product.count({ where: { active: true, fitments: { some: {} } } }),
      prisma.product.count({ where: { active: true, NOT: { oemRefs: { isEmpty: true } } } }),
      prisma.product.count({ where: { active: true, images: { some: {} } } }),
      prisma.brand.count({ where: { products: { some: { active: true } } } }),
      prisma.importBatch.findFirst({
        where: { status: "APPLIED" },
        orderBy: { appliedAt: "desc" },
        select: { appliedAt: true, filename: true },
      }),
    ]);

  const contact = publicContact(settings);
  const help = contactLink(contact, "Bonjour, j'ai une question sur la compatibilité d'une pièce.");
  const pct = (n: number) => (productCount === 0 ? 0 : Math.round((n / productCount) * 100));

  return (
    <>
      <JsonLd data={breadcrumbSchema(CRUMBS)} />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <Breadcrumbs items={CRUMBS} />

        <h1 className="mt-4 text-3xl sm:text-4xl font-heading font-extrabold uppercase tracking-tight text-navy-950">
          Sources et méthode
        </h1>
        <p className="mt-3 text-gray-600 leading-relaxed">
          Une pièce qui ne va pas sur la voiture, c&apos;est un retour, une journée perdue et un client
          qui ne revient pas. Cette page explique d&apos;où viennent les informations que vous lisez sur
          nos fiches produit, comment elles sont vérifiées, et surtout ce que nous ne prétendons pas savoir.
        </p>

        {/* Real counts, so the page cannot drift away from the catalogue. */}
        <section aria-labelledby="etat" className="mt-8">
          <h2 id="etat" className="font-heading font-extrabold uppercase tracking-tight text-navy-950 text-xl">
            État du catalogue
          </h2>
          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Références actives", value: productCount },
              { label: "Avec compatibilité vérifiée", value: withFitment, sub: `${pct(withFitment)} %` },
              { label: "Avec références OE", value: withOem, sub: `${pct(withOem)} %` },
              { label: "Avec photo réelle", value: withPhotos, sub: `${pct(withPhotos)} %` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4">
                <dt className="text-[11px] font-display font-bold uppercase tracking-wide text-gray-600">
                  {s.label}
                </dt>
                <dd className="mt-1 text-2xl font-heading font-extrabold text-navy-950 tabular-nums">
                  {s.value}
                  {s.sub && <span className="block text-xs font-normal text-gray-500">{s.sub}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-gray-500">
            Chiffres comptés au moment où vous chargez cette page. {brandCount > 0 && `${brandCount} marque(s) distribuée(s). `}
            {lastImport?.appliedAt &&
              `Dernière mise à jour du catalogue : ${new Date(lastImport.appliedAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}.`}
          </p>
        </section>

        <Section id="references" title="Les références">
          <p>
            Chaque fiche porte la référence fabricant inscrite sur la pièce elle-même. C&apos;est
            l&apos;identifiant qui compte : deux pièces d&apos;apparence identique peuvent porter des
            références différentes et ne pas convenir au même véhicule.
          </p>
          <p>
            Les références OE mentionnées désignent la pièce d&apos;origine que la nôtre remplace. Elles
            servent à vous permettre de retrouver une pièce à partir de l&apos;ancienne facture ou du
            marquage d&apos;origine. <strong>Elles n&apos;impliquent aucun lien commercial avec le
            constructeur</strong> et ne signifient pas que la pièce est fournie par lui.
          </p>
        </Section>

        <Section id="compatibilite" title="La compatibilité">
          <p>
            Une pièce est déclarée compatible avec une motorisation précise — marque, modèle, moteur —
            et non avec un modèle en général. Deux voitures du même modèle et de la même année peuvent
            demander des pièces différentes selon la motorisation ou la finition.
          </p>
          <p>
            Quand une pièce n&apos;a pas encore de données de compatibilité, la fiche le dit. Elle
            n&apos;est pas déclarée incompatible : elle est <strong>non vérifiée</strong>, ce qui est une
            information différente et que nous préférons afficher plutôt que masquer.
          </p>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
            En cas de doute, la référence gravée sur votre pièce d&apos;origine ou le numéro de série de
            votre carte grise tranche mieux que n&apos;importe quelle recherche par modèle. Envoyez-la
            nous, on vérifie avant que vous commandiez.
          </p>
        </Section>

        <Section id="prix" title="Les prix et le stock">
          <p>
            Les prix affichés sont ceux pratiqués en magasin, toutes taxes comprises, en dinars tunisiens.
            Le prix barré, quand il apparaît, est notre prix de référence antérieur sur la même pièce —
            jamais un prix inventé pour donner l&apos;impression d&apos;une remise.
          </p>
          <p>
            Le stock affiché est celui de notre inventaire au moment de l&apos;affichage. Il est décrémenté
            au moment où une commande est validée, pas avant, ce qui évite de vous réserver une pièce qui
            vient d&apos;être vendue au comptoir.
          </p>
        </Section>

        <Section id="photos" title="Les photos">
          <p>
            Les photos sont celles des pièces que nous vendons. Lorsqu&apos;une référence n&apos;a pas
            encore été photographiée, une illustration générique de la famille est affichée à la place —
            elle est là pour situer le type de pièce, pas pour montrer l&apos;article exact.
          </p>
        </Section>

        <Section id="mise-a-jour" title="Comment le catalogue est mis à jour">
          <p>
            Le catalogue est chargé depuis les fichiers de nos fournisseurs. Chaque import est enregistré :
            on sait quel fichier a créé ou modifié quelle référence, et un import peut être annulé en bloc
            s&apos;il s&apos;avère erroné. C&apos;est ce qui permet de corriger une erreur de source sans
            reconstruire le catalogue à la main.
          </p>
          <p>
            Le catalogue est en cours de constitution. Une pièce absente du site ne signifie pas que nous
            ne pouvons pas vous la fournir — demandez-la.
          </p>
        </Section>

        <Section id="limites" title="Ce que nous ne garantissons pas">
          <ul className="list-disc ps-5 space-y-1.5">
            <li>
              Nous ne garantissons pas qu&apos;une pièce sans données de compatibilité conviendra à votre
              véhicule.
            </li>
            <li>
              Nous ne garantissons pas l&apos;exhaustivité des références OE : elles proviennent des
              catalogues fournisseurs et peuvent être incomplètes.
            </li>
            <li>
              Nous ne publions pas d&apos;avis clients tant que nous n&apos;en avons pas de véritables.
            </li>
            <li>
              Nous n&apos;affichons pas de délai de livraison à la journée près : les délais annoncés
              (24h Grand Tunis, 48–72h régions) sont des délais habituels, pas un engagement contractuel.
            </li>
          </ul>
        </Section>

        <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950">
            Une question sur une pièce précise ?
          </h2>
          <p className="text-sm text-gray-600 mt-1 mb-4">
            Donnez-nous la référence ou les détails de votre véhicule, on vérifie avant que vous commandiez.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={help}
              {...contactLinkProps(help)}
              className="inline-flex items-center min-h-tap px-5 rounded-xl bg-navy-950 hover:bg-navy-800 text-white font-display font-bold uppercase text-xs tracking-wide transition-colors"
            >
              Nous contacter
            </a>
            <Link
              href="/recherche"
              className="inline-flex items-center min-h-tap px-5 rounded-xl border border-gray-300 text-navy-900 font-semibold text-sm hover:border-navy-700 transition-colors"
            >
              Chercher par référence
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="font-heading font-extrabold uppercase tracking-tight text-navy-950 text-xl">
        {title}
      </h2>
      <div className="mt-2 flex flex-col gap-3 text-gray-600 leading-relaxed">{children}</div>
    </section>
  );
}
