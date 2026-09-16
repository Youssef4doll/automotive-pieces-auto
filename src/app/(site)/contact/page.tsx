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
import {
  IconWhatsApp,
  IconPackage,
  IconCar,
  IconReturn,
  IconMapPin,
  IconClock,
  IconPhone,
  IconMail,
  IconArrowRight,
  IconChat,
  IconStore,
} from "@/components/icons";

// generateMetadata rather than a constant, because the description named
// WhatsApp — and a shop that has not entered a WhatsApp number does not offer
// one. getSettings is React-cached per request, so the page body below reads
// the same rows without a second query.
export async function generateMetadata(): Promise<Metadata> {
  const contact = publicContact(await getSettings());
  return pageMeta({
    title: "Contact",
    description: contact.whatsapp
      ? "Une question sur une pièce, une commande ou un retour ? Écrivez-nous, ou passez par WhatsApp si c'est urgent."
      : "Une question sur une pièce, une commande ou un retour ? Écrivez-nous et nous répondons.",
    path: "/contact",
  });
}

const CRUMBS = [
  { name: "Accueil", path: "/" },
  { name: "Contact", path: "/contact" },
];

/** A link to the form with the subject already chosen. */
const ask = (subject: string) => `/contact?sujet=${encodeURIComponent(subject)}#ecrire`;

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
 * that lists none. For the same reason nothing here promises a reply *time* —
 * the shop has not committed to one, and a made-up "réponse sous 2h" is a
 * promise a customer can hold us to.
 */
export default async function ContactPage() {
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const contact = publicContact(settings);
  const whatsappHref = contact.whatsapp ? contactLink({ whatsapp: contact.whatsapp, email: null }) : null;
  const telHref = contact.phone ? `tel:${contact.phone.replace(/[^\d+]/g, "")}` : null;

  // The four things people arrive on this page to do. The first is whichever
  // live channel the shop has actually set up, and disappears entirely when it
  // has set up neither — a "call us" card with no number behind it is worse
  // than no card. The other three each carry their subject into the form, so
  // the shopper writes their question rather than first describing which kind
  // of question it is.
  const shortcuts = [
    whatsappHref
      ? {
          key: "whatsapp",
          Icon: IconWhatsApp,
          title: "Parler à quelqu'un",
          sub: "WhatsApp · réponse la plus rapide",
          href: whatsappHref,
          external: true,
          accent: true,
        }
      : telHref
        ? {
            key: "phone",
            Icon: IconPhone,
            title: "Parler à quelqu'un",
            sub: contact.phone!,
            href: telHref,
            external: true,
            accent: true,
          }
        : null,
    {
      key: "order",
      Icon: IconPackage,
      title: "Où est ma commande ?",
      sub: "Suivre une commande",
      href: "/compte/commandes",
      external: false,
      accent: false,
    },
    {
      key: "fit",
      Icon: IconCar,
      title: "Est-ce que ça va sur ma voiture ?",
      sub: "Compatibilité d'une pièce",
      href: ask("Compatibilité d'une pièce"),
      external: false,
      accent: false,
    },
    {
      key: "return",
      Icon: IconReturn,
      title: "Retour ou échange",
      sub: "Garantie 12 mois · 14 jours pour changer d'avis",
      href: ask("Retour ou échange"),
      external: false,
      accent: false,
    },
  ].filter((s): s is NonNullable<typeof s> => Boolean(s));

  type Detail = {
    key: string;
    Icon: typeof IconMapPin;
    label: string;
    value: string;
    href?: string;
    external?: boolean;
  };

  const details: Detail[] = [];
  if (contact.address)
    details.push({
      key: "address",
      Icon: IconMapPin,
      label: "Adresse",
      value: contact.address,
      // A map *search* for the address the shop typed, not a pin at
      // coordinates nobody has given us. It lands the customer on the right
      // street without our inventing a spot on it.
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`,
      external: true,
    });
  if (contact.hours)
    details.push({ key: "hours", Icon: IconClock, label: "Horaires", value: contact.hours });
  if (contact.phone && telHref)
    details.push({ key: "phone", Icon: IconPhone, label: "Téléphone", value: contact.phone, href: telHref });
  if (contact.email)
    details.push({
      key: "email",
      Icon: IconMail,
      label: "E-mail",
      value: contact.email,
      href: `mailto:${contact.email}`,
    });

  return (
    <div className="mx-auto shell-w px-4 py-6 sm:py-10">
      <JsonLd data={breadcrumbSchema(CRUMBS)} />
      <Breadcrumbs items={CRUMBS} />

      <h1 className="mt-3 font-heading text-2xl font-extrabold uppercase tracking-tight text-navy-950 sm:text-4xl">
        Besoin d&apos;aide ? Nous sommes là.
      </h1>
      {/* The second sentence is conditional, because it names a channel. A
          shop that has not entered a WhatsApp number was still being told that
          WhatsApp is the fastest way to reach it, on a page that then offered
          no WhatsApp anywhere. */}
      <p className="mt-2 max-w-prose text-sm text-gray-600 sm:text-base">
        Une question sur la compatibilité d&apos;une pièce, une commande en cours, un retour : écrivez-nous et
        nous répondons.
        {whatsappHref && " Pour une réponse tout de suite, WhatsApp est le plus rapide."}
      </p>

      <div
        className={`mt-6 grid gap-3 sm:grid-cols-2 ${shortcuts.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
      >
        {shortcuts.map(({ key, Icon, title, sub, href, external, accent }) => {
          const body = (
            <>
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  accent ? "bg-green-50 text-green-700" : "bg-navy-50 text-navy-900"
                }`}
              >
                <Icon />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-display text-sm font-bold uppercase tracking-wide text-navy-950">
                  {title}
                </span>
                <span className={`text-sm ${accent ? "text-green-700" : "text-navy-900/60"}`}>{sub}</span>
              </span>
            </>
          );
          const className =
            "flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gold-500 hover:shadow-sm";
          return external ? (
            <a key={key} href={href} {...contactLinkProps(href)} className={className}>
              {body}
            </a>
          ) : (
            // Two of these link to /contact itself with a different ?sujet=,
            // and Next prefetched each one on sight — RSC requests for the
            // page the browser is already looking at, which then advertise
            // the same two links again. They were measured still open five
            // seconds after load, having fetched nothing the visitor did not
            // already have. The link to the order list is a different page
            // and is left to prefetch normally.
            <Link
              key={key}
              href={href}
              prefetch={href.startsWith("/contact") ? false : undefined}
              className={className}
            >
              {body}
            </Link>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-10">
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="flex items-center gap-2 font-heading text-lg font-extrabold uppercase tracking-tight text-navy-950">
              <IconStore className="h-[18px] w-[18px] text-gold-500" />
              Le magasin
            </h2>
            {details.length > 0 ? (
              <dl className="mt-3 flex flex-col gap-3.5 rounded-xl border border-gray-200 bg-white p-4 text-sm">
                {details.map((d) => (
                  <div key={d.key} className="flex items-start gap-3">
                    <span className="mt-0.5 text-navy-900/40">
                      <d.Icon />
                    </span>
                    <div className="min-w-0">
                      <dt className="font-display text-xs font-bold uppercase tracking-wide text-navy-900/45">
                        {d.label}
                      </dt>
                      <dd className="mt-0.5 text-gray-700">
                        {d.href ? (
                          <a
                            href={d.href}
                            dir="ltr"
                            {...(d.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                            className="inline-flex min-h-tap-compact items-center text-start underline underline-offset-2 hover:text-red-600"
                          >
                            {d.value}
                          </a>
                        ) : (
                          d.value
                        )}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
                Les coordonnées du magasin ne sont pas encore renseignées — le formulaire ci-contre nous
                atteint quand même.
              </p>
            )}
          </section>

          {/* What happens to the message, stated. No reply time is promised
              here or anywhere else on the site: the shop has not committed to
              one, so naming a number would be inventing a commitment on its
              behalf. What *is* certain is where the message lands and what
              travels with it. */}
          <section className="rounded-xl border border-gray-200 bg-slate-50 p-4">
            <h2 className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wide text-navy-900/45">
              <IconChat className="text-navy-900/40" />
              Ce qui se passe ensuite
            </h2>
            <ul className="mt-2.5 flex flex-col gap-2 text-sm text-gray-700">
              <li className="flex gap-2">
                <IconArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                Votre message arrive dans la boîte du magasin, pas dans une adresse générique.
              </li>
              <li className="flex gap-2">
                <IconArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                La commande, la référence de la pièce et votre véhicule partent avec, s&apos;ils sont connus.
              </li>
              <li className="flex gap-2">
                <IconArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                Nous répondons à l&apos;adresse e-mail que vous indiquez.
              </li>
            </ul>
          </section>
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
              hasWhatsApp={Boolean(whatsappHref)}
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
