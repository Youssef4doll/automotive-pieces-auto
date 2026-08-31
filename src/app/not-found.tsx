import Link from "next/link";
import type { Metadata } from "next";
import { getMegaMenu } from "@/lib/data/catalog";
import { getSettings, publicContact } from "@/lib/settings";
import { contactLink, contactLinkProps } from "@/lib/contact-link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NotFoundSearch from "@/components/NotFoundSearch";

export const metadata: Metadata = {
  title: "Page introuvable",
  description: "Cette page n'existe pas ou plus. Retrouvez vos pièces par famille, par référence ou par véhicule.",
  robots: { index: false, follow: true },
};

/**
 * The 404 for a parts shop should do a parts shop's job.
 *
 * Most arrivals here are a mistyped reference, a link to a part that has been
 * withdrawn, or an old catalogue URL. So this page carries a search box, the
 * real families from the database, and a way to ask a person — rather than an
 * apology and a link home. It is `noindex, follow` so crawlers drop the URL but
 * still follow the routes out of it.
 *
 * It lives at the app root, so it also serves routes outside the `(site)` group
 * and therefore renders the header and footer itself.
 */
export default async function NotFound() {
  const [families, settings] = await Promise.all([getMegaMenu(), getSettings()]);
  const contact = publicContact(settings);
  const help = contactLink(contact, "Bonjour, je ne trouve pas une pièce sur votre site.");
  const stocked = families.filter((f) => f.children.some((c) => c._count.products > 0));

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <p className="font-display font-bold uppercase tracking-[0.18em] text-xs text-red-600">Erreur 404</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-heading font-extrabold uppercase tracking-tight text-navy-950">
          Cette page n&apos;existe pas
        </h1>
        <p className="mt-3 text-gray-600 max-w-prose">
          Le lien est peut-être ancien, ou la pièce n&apos;est plus au catalogue. Cherchez par référence — celle
          gravée sur la pièce ou inscrite sur l&apos;ancienne facture — c&apos;est le moyen le plus sûr de
          retrouver la bonne.
        </p>

        <div className="mt-6">
          <NotFoundSearch />
        </div>

        {stocked.length > 0 && (
          <section className="mt-10">
            <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 mb-3">
              Parcourir par famille
            </h2>
            <ul className="flex flex-wrap gap-2">
              {stocked.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/catalogue/${f.slug}`}
                    className="inline-flex items-center min-h-tap-compact px-4 rounded-full border border-gray-300 bg-white text-sm text-gray-700 hover:border-navy-700 hover:text-navy-950 transition-colors"
                  >
                    {f.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950">
            Vous savez ce qu&apos;il vous faut ?
          </h2>
          <p className="text-sm text-gray-600 mt-1 mb-4">
            Envoyez-nous la référence ou une photo de la pièce, on la retrouve pour vous.
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
              href="/"
              className="inline-flex items-center min-h-tap px-5 rounded-xl border border-gray-300 text-navy-900 font-semibold text-sm hover:border-navy-700 transition-colors"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
