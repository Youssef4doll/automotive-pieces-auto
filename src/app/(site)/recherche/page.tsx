import Link from "next/link";
import { searchProducts, getMegaMenu } from "@/lib/data/catalog";
import { getSettings, publicContact } from "@/lib/settings";
import { contactLink } from "@/lib/contact-link";
import SearchResults from "@/components/SearchResults";
import { FamilyThumb } from "@/components/FamiliesTabs";
import { didYouMean, parseQuery } from "@/lib/search";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// One canonical for every query. A search result page per phrase anyone ever
// types is an unbounded set of near-identical pages; robots.txt already keeps
// crawlers off the query strings, and this makes the intent explicit.
export const metadata: Metadata = pageMeta({
  title: "Rechercher une pièce",
  description:
    "Cherchez une pièce par référence, par marque ou par nom. Nous indiquons la compatibilité avec votre véhicule.",
  path: "/recherche",
  noIndex: true,
});

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const parsed = parseQuery(query);

  const [products, settings, families] = await Promise.all([
    searchProducts(query),
    getSettings(),
    getMegaMenu(),
  ]);
  // Only computed when it can change the outcome: a correction shown above a
  // page full of good results is noise. "Every result was a guess" counts as
  // an outcome worth correcting, even when the page is not empty.
  const worthCorrecting =
    products.length === 0 || products.every((p) => (p.matchTier ?? 1) > 1);
  const suggestion = worthCorrecting ? await didYouMean(parsed) : null;

  const contact = publicContact(settings);
  const askHref = contactLink(contact, `Bonjour, je cherche : ${query}. Pouvez-vous m'aider à la trouver ?`);
  const askLabel = contact.whatsapp
    ? "Demander cette pièce sur WhatsApp"
    : contact.email
      ? "Demander cette pièce par email"
      : "Nous contacter pour cette pièce";

  if (!query) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-xl font-heading font-extrabold uppercase text-navy-950 mb-1 tracking-tight">Rechercher</h1>
        <p className="text-sm text-gray-500 mb-6">
          Tapez un nom de pièce, une référence constructeur ou une référence OEM.
        </p>
        {/* The same picture-led board as the home page, using the very same
            FamilyThumb, so the two cannot drift apart.

            It was a row of plain text pills. Somebody who has arrived at an
            empty search box is, by definition, the shopper who could not name
            what they are after — handing them sixteen French nouns is the
            least useful thing this page can do, and the picture of the part
            is what they actually recognise. */}
        <div className="grid grid-cols-2 min-[380px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2.5">
          {families.map((f) => (
            <Link
              key={f.id}
              href={`/catalogue/${f.slug}`}
              className="group flex flex-col items-center gap-2 p-2.5 sm:p-3 rounded-xl border border-navy-900/10 bg-white text-center transition hover:border-gold-500 hover:shadow-sm hover:-translate-y-0.5"
            >
              <FamilyThumb slug={f.slug} imageUrl={f.imageUrl} />
              <span className="w-full min-w-0 line-clamp-2 [overflow-wrap:anywhere] font-display font-bold uppercase tracking-wide text-[12px] sm:text-[13px] text-navy-950 leading-tight">
                {f.name}
              </span>
              {/* Counted from the catalogue, the same number the home page
                  shows — never an estimate. */}
              <span className="text-[12px] text-navy-900/50 leading-none">
                {f.productCount} pièce{f.productCount > 1 ? "s" : ""}
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-xl font-heading font-extrabold uppercase text-navy-950 mb-1 tracking-tight">
        Résultats pour « {query} »
      </h1>
      <p className="text-sm text-gray-500 mb-5">
        {products.length} résultat{products.length > 1 ? "s" : ""}
        {/* What the search understood, so a customer who typed "kit distri"
            can see it was read as a timing kit rather than wonder why belts
            came back. */}
        {parsed.canonical.length > 0 && (
          <span className="text-gray-600"> · compris comme : {parsed.canonical.join(", ")}</span>
        )}
      </p>

      <SearchResults
        query={query}
        products={products}
        suggestion={suggestion?.term ?? null}
        contactHref={askHref}
        contactLabel={askLabel}
        fallbacks={families.map((f) => ({ id: f.id, name: f.name, slug: f.slug }))}
      />
    </div>
  );
}
