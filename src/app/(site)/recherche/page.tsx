import Link from "next/link";
import { searchProducts, getMegaMenu } from "@/lib/data/catalog";
import { getSettings, publicContact } from "@/lib/settings";
import { contactLink } from "@/lib/contact-link";
import SearchResults from "@/components/SearchResults";
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
        <div className="flex flex-wrap gap-2">
          {families.map((f) => (
            <Link
              key={f.id}
              href={`/catalogue/${f.slug}`}
              className="inline-flex items-center min-h-tap-compact px-3 rounded-full border border-gray-300 bg-white text-sm text-gray-700 hover:border-navy-300"
            >
              {f.name}
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
