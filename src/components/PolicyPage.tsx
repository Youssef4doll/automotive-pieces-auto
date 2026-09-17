import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import Breadcrumbs from "@/components/Breadcrumbs";
import { breadcrumbSchema } from "@/lib/schema";
import type { PublicContact } from "@/lib/settings";
import { telHref } from "@/lib/settings";
import { IconAlert } from "@/components/icons";

/**
 * The shell the three policy pages share.
 *
 * An audit found the footer's "Conditions · Confidentialité" was plain text
 * rather than links, and "Livraison & retours" opened WhatsApp — so a
 * first-time buyer being asked to hand cash to a courier had no way to read
 * what they were agreeing to. These pages are that answer.
 *
 * The identity block at the foot is the honest part. A shop's address, phone
 * and matricule fiscal are facts only the owner has, and inventing them would
 * be worse than leaving them out: a customer who checks and finds a made-up
 * registration has learned something much worse than "not published yet". So
 * each page prints whatever the shop has actually entered in
 * /admin/parametres and says plainly which of it is still missing.
 */
export default function PolicyPage({
  title,
  path,
  intro,
  updated,
  contact,
  children,
}: {
  title: string;
  path: string;
  intro: string;
  /** When the text itself last changed — not "today", which means nothing. */
  updated: string;
  contact: PublicContact;
  children: React.ReactNode;
}) {
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: title, path },
  ];

  const known: [string, React.ReactNode][] = [["Dénomination", contact.name]];
  if (contact.address) known.push(["Adresse", contact.address]);
  if (contact.phone)
    known.push([
      "Téléphone",
      <a key="tel" href={telHref(contact.phone)} dir="ltr" className="underline underline-offset-2">
        {contact.phone}
      </a>,
    ]);
  if (contact.email)
    known.push([
      "E-mail",
      <a key="mail" href={`mailto:${contact.email}`} className="underline underline-offset-2 break-all">
        {contact.email}
      </a>,
    ]);
  if (contact.hours) known.push(["Horaires", contact.hours]);

  const missing = [
    !contact.address && "l'adresse du magasin",
    !contact.phone && "le numéro de téléphone",
    !contact.email && "l'adresse e-mail",
  ].filter(Boolean) as string[];

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <Breadcrumbs items={crumbs} />

        <h1 className="mt-4 text-3xl sm:text-4xl font-heading font-extrabold uppercase tracking-tight text-navy-950">
          {title}
        </h1>
        <p className="mt-3 leading-relaxed text-gray-600">{intro}</p>
        <p className="mt-2 text-sm text-gray-500">Dernière mise à jour : {updated}</p>

        <div className="mt-8 flex flex-col gap-8">{children}</div>

        <section aria-labelledby="identite" className="mt-10 rounded-2xl border border-gray-200 bg-white p-5">
          <h2
            id="identite"
            className="font-heading text-lg font-extrabold uppercase tracking-tight text-navy-950"
          >
            Qui vend
          </h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {known.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[12px] font-display font-bold uppercase tracking-wide text-gray-600">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm text-navy-950">{value}</dd>
              </div>
            ))}
          </dl>

          {missing.length > 0 && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Nous n&apos;avons pas encore publié {missing.join(", ")} sur le site. Écrivez-nous depuis
                la <Link href="/contact" className="underline underline-offset-2">page contact</Link> et
                nous vous les communiquons.
              </span>
            </p>
          )}
        </section>

        <nav aria-label="Autres pages d'information" className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {[
            ["Conditions générales de vente", "/conditions"],
            ["Livraison et retours", "/livraison-retours"],
            ["Confidentialité", "/confidentialite"],
            ["Sources et méthode", "/sources"],
          ]
            .filter(([, href]) => href !== path)
            .map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="font-semibold text-navy-900 underline underline-offset-2 hover:text-red-600"
              >
                {label}
              </Link>
            ))}
        </nav>
      </div>
    </>
  );
}

/** A titled block, styled once so the three pages cannot drift apart. */
export function PolicySection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className="font-heading text-xl font-extrabold uppercase tracking-tight text-navy-950"
      >
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 leading-relaxed text-gray-700 [&_a]:font-semibold [&_a]:text-navy-900 [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-navy-950">
        {children}
      </div>
    </section>
  );
}
