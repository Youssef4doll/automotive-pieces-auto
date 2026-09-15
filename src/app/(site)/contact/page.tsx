import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getSettings, publicContact } from "@/lib/settings";
import { contactLink, contactLinkProps } from "@/lib/contact-link";
import { getCurrentUser } from "@/lib/session";
import { pageMeta } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import Breadcrumbs from "@/components/Breadcrumbs";
import { breadcrumbSchema } from "@/lib/schema";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = pageMeta({
  title: "Contact",
  description:
    "Une question sur une pièce, une commande ou un retour ? Écrivez-nous, ou passez par WhatsApp si c'est urgent.",
  path: "/contact",
});

const CRUMBS = [
  { name: "Accueil", path: "/" },
  { name: "Contact", path: "/contact" },
];

/**
 * One place to reach the shop.
 *
 * Every "Contact" on the site used to be a WhatsApp link. That is the channel
 * Tunisian customers actually use and it stays — it is the first thing on this
 * page — but on its own it left the shop owning no record of anything: a
 * question asked on WhatsApp lives on one phone, cannot be counted, cannot be
 * handed over to whoever is working tomorrow, and cannot be produced when a
 * customer disputes what was agreed.
 *
 * So the page offers both, and says plainly which is faster. What is written
 * in the form lands in the shop's own inbox (/admin/messages) with the order,
 * the part and the car already attached.
 *
 * Everything on the left is real: an address, hours, a phone number or an
 * e-mail appears only once the owner has entered it in /admin/parametres.
 * A contact page that lists a placeholder telephone number is worse than one
 * that lists none.
 */
export default async function ContactPage() {
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const contact = publicContact(settings);
  const whatsappHref = contact.whatsapp ? contactLink({ whatsapp: contact.whatsapp, email: null }) : null;

  const details = [
    contact.address && { label: "Adresse", value: contact.address },
    contact.hours && { label: "Horaires", value: contact.hours },
    contact.phone && { label: "Téléphone", value: contact.phone, href: `tel:${contact.phone.replace(/[^\d+]/g, "")}` },
    contact.email && { label: "E-mail", value: contact.email, href: `mailto:${contact.email}` },
  ].filter((d): d is { label: string; value: string; href?: string } => Boolean(d));

  return (
    <div className="mx-auto shell-w px-4 py-6 sm:py-10">
      <JsonLd data={breadcrumbSchema(CRUMBS)} />
      <Breadcrumbs items={CRUMBS} />

      <h1 className="mt-3 font-heading text-2xl font-extrabold uppercase tracking-tight text-navy-950 sm:text-4xl">
        Besoin d&apos;aide ? Nous sommes là.
      </h1>
      <p className="mt-2 max-w-prose text-sm text-gray-600 sm:text-base">
        Une question sur la compatibilité d&apos;une pièce, une commande en cours, un retour : écrivez-nous et
        nous répondons. Pour une réponse tout de suite, WhatsApp est le plus rapide.
      </p>

      {/* The three questions people actually arrive with, each going straight
          to the thing that answers it rather than to a form they then have to
          describe it in. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {whatsappHref && (
          <a
            href={whatsappHref}
            {...contactLinkProps(whatsappHref)}
            className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gold-500 hover:shadow-sm"
          >
            <span className="font-display text-sm font-bold uppercase tracking-wide text-navy-950">
              Parler à quelqu&apos;un
            </span>
            <span className="text-sm text-green-700">WhatsApp · réponse la plus rapide</span>
          </a>
        )}
        <Link
          href="/compte/commandes"
          className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gold-500 hover:shadow-sm"
        >
          <span className="font-display text-sm font-bold uppercase tracking-wide text-navy-950">
            Où est ma commande ?
          </span>
          <span className="text-sm text-navy-900/60">Suivre une commande</span>
        </Link>
        <a
          href="#ecrire"
          className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gold-500 hover:shadow-sm"
        >
          <span className="font-display text-sm font-bold uppercase tracking-wide text-navy-950">
            Retour ou échange
          </span>
          <span className="text-sm text-navy-900/60">Garantie 12 mois · 14 jours pour changer d&apos;avis</span>
        </a>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-10">
        <div>
          <h2 className="font-heading text-lg font-extrabold uppercase tracking-tight text-navy-950">
            Le magasin
          </h2>
          {details.length > 0 ? (
            <dl className="mt-3 flex flex-col gap-3 text-sm">
              {details.map((d) => (
                <div key={d.label}>
                  <dt className="font-display text-xs font-bold uppercase tracking-wide text-navy-900/45">
                    {d.label}
                  </dt>
                  <dd className="mt-0.5 text-gray-700">
                    {d.href ? (
                      <a href={d.href} dir="ltr" className="inline-flex min-h-tap-compact items-center text-start underline underline-offset-2 hover:text-red-600">
                        {d.value}
                      </a>
                    ) : (
                      d.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              Les coordonnées du magasin ne sont pas encore renseignées — le formulaire ci-contre nous
              atteint quand même.
            </p>
          )}
        </div>

        <div id="ecrire" className="scroll-mt-28">
          <h2 className="font-heading text-lg font-extrabold uppercase tracking-tight text-navy-950">
            Écrivez-nous
          </h2>
          <p className="mt-1 mb-3 text-sm text-gray-600">
            Les champs marqués d&apos;un astérisque sont obligatoires.
          </p>
          {/* useSearchParams inside, so the form needs a boundary to stream
              behind rather than opting the whole page out of prerendering. */}
          <Suspense fallback={<div className="h-[420px] rounded-xl border border-gray-200 bg-white" />}>
            <ContactForm
              defaults={{
                name: user?.name ?? "",
                email: user?.email ?? "",
                phone: user?.phone ?? "",
              }}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
