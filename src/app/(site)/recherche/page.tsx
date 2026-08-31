import Link from "next/link";
import { searchProducts, getMegaMenu, getTopSellers } from "@/lib/data/catalog";
import { getSettings, publicContact } from "@/lib/settings";
import { contactLink, contactLinkProps } from "@/lib/contact-link";
import ProductGrid from "@/components/ProductGrid";
import TrackEvent from "@/components/TrackEvent";

export const metadata = { title: "Résultats de recherche" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  const [products, settings, families] = await Promise.all([
    searchProducts(query),
    getSettings(),
    getMegaMenu(),
  ]);
  // Only fetched when we have nothing to show, so an empty-handed shopper
  // still leaves with something to look at.
  const suggestions = products.length === 0 ? await getTopSellers(4) : [];
  const contact = publicContact(settings);
  const askHref = contactLink(contact, `Bonjour, je cherche : ${query}. Pouvez-vous m'aider à la trouver ?`);

  if (!query) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-xl font-heading font-extrabold uppercase text-navy-950 mb-1 tracking-tight">Rechercher</h1>
        <p className="text-sm text-gray-500 mb-6">
          Tapez un nom de pièce, une référence constructeur ou une référence OEM.
        </p>
        <FamilyLinks families={families} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* A search that returns nothing is the clearest demand signal the shop
          gets: it is a customer telling us what we should be stocking. It is
          recorded with its result count so the zero-result list can be read
          back in analytics. */}
      <TrackEvent name="search_performed" properties={{ query, resultCount: products.length }} />

      <h1 className="text-xl font-heading font-extrabold uppercase text-navy-950 mb-1 tracking-tight">
        Résultats pour « {query} »
      </h1>
      <p className="text-sm text-gray-500 mb-6">{products.length} résultat(s)</p>

      {products.length === 0 ? (
        <div className="flex flex-col gap-8">
          <div className="text-center py-10 px-4 border border-dashed border-gray-300 rounded-xl">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-gray-700 font-medium mb-1">Aucune pièce ne correspond à « {query} »</p>
            <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">
              Vérifiez l&apos;orthographe, essayez la référence inscrite sur la pièce, ou envoyez-nous une photo —
              on la retrouve pour vous.
            </p>
            {/* The label names whichever channel the shop has configured, so
                the button never promises WhatsApp and open a mail client. */}
            <a
              href={askHref}
              {...contactLinkProps(askHref)}
              className="inline-flex items-center justify-center gap-2 min-h-tap px-5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold"
            >
              {contact.whatsapp
                ? "Demander cette pièce sur WhatsApp"
                : contact.email
                  ? "Demander cette pièce par email"
                  : "Nous contacter pour cette pièce"}
            </a>
          </div>

          {suggestions.length > 0 && (
            <section>
              <h2 className="font-heading font-extrabold uppercase text-navy-950 mb-3 tracking-tight">
                Nos pièces les plus demandées
              </h2>
              <ProductGrid products={suggestions} />
            </section>
          )}

          <section>
            <h2 className="font-heading font-extrabold uppercase text-navy-950 mb-3 tracking-tight">
              Parcourir par famille
            </h2>
            <FamilyLinks families={families} />
          </section>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}

function FamilyLinks({ families }: { families: { id: string; name: string; slug: string }[] }) {
  return (
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
  );
}
