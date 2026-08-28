import Link from "next/link";
import ProductGrid from "./ProductGrid";
import CatalogControls from "./CatalogControls";
import TrackEvent from "./TrackEvent";
import type { CardProduct } from "./ProductCard";

type Sibling = { id: string; name: string; slug: string };
type BrandFacet = { name: string; slug: string; count: number };

export default function CatalogView({
  family,
  subfamily,
  siblings,
  products,
  brands,
  activeBrandSlug,
  activeSort,
  whatsapp,
}: {
  family: { name: string; slug: string };
  subfamily?: { name: string; slug: string } | null;
  siblings: Sibling[];
  products: CardProduct[];
  brands: BrandFacet[];
  activeBrandSlug?: string;
  activeSort?: string;
  whatsapp: string;
}) {
  const title = subfamily ? subfamily.name : family.name;
  const basePath = subfamily ? `/catalogue/${family.slug}/${subfamily.slug}` : `/catalogue/${family.slug}`;

  // w-full + min-w-0 on the page container: <main> is a column flex container,
  // so this container is a flex item and defaults to min-width:auto — it would
  // inflate to the min-content width of the horizontally scrolling filter chips
  // below and push the whole page sideways. It has to opt out explicitly.
  return (
    <div className="w-full min-w-0 mx-auto max-w-7xl px-4 py-6">
      <TrackEvent
        name="category_viewed"
        properties={{ family: family.slug, subfamily: subfamily?.slug ?? null, resultCount: products.length }}
      />
      <nav className="text-xs text-gray-500 mb-3 flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-navy-900 inline-flex items-center min-h-tap -my-2">Accueil</Link>
        <span>›</span>
        <Link href={`/catalogue/${family.slug}`} className="hover:text-navy-900 inline-flex items-center min-h-tap -my-2">{family.name}</Link>
        {subfamily && (
          <>
            <span>›</span>
            <span className="text-navy-900 font-medium">{subfamily.name}</span>
          </>
        )}
      </nav>

      <h1 className="text-xl sm:text-2xl font-heading font-extrabold uppercase text-navy-950 mb-1 tracking-tight">{title}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {products.length} référence{products.length > 1 ? "s" : ""} · 24h Grand Tunis, 48–72h régions
      </p>

      {/* On phones the sidebar used to render first and fill the whole screen
          with a bare list of ten subcategory links, so the shopper scrolled
          past every filter before seeing a single product. The filters are
          the same links, laid out as one scrollable row each, which puts the
          products back above the fold. The desktop sidebar is unchanged. */}
      <div className="lg:hidden flex flex-col gap-2 mb-4">
        {siblings.length > 0 && (
          <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 w-max">
              {siblings.map((s) => {
                const active = subfamily?.slug === s.slug;
                return (
                  <Link
                    key={s.id}
                    href={active ? `/catalogue/${family.slug}` : `/catalogue/${family.slug}/${s.slug}`}
                    className={`inline-flex items-center whitespace-nowrap px-3 min-h-tap-compact rounded-full border text-sm ${
                      active
                        ? "bg-navy-900 border-navy-900 text-white font-semibold"
                        : "bg-white border-gray-300 text-gray-700"
                    }`}
                  >
                    {s.name}
                    {active && <span className="ms-1.5">✕</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        {brands.length > 0 && (
          <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 w-max">
              {brands.map((b) => {
                const active = activeBrandSlug === b.slug;
                return (
                  <Link
                    key={b.slug}
                    href={`${basePath}?brand=${active ? "" : b.slug}${activeSort ? `&sort=${activeSort}` : ""}`}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3 min-h-tap-compact rounded-full border text-sm ${
                      active
                        ? "bg-gold-500 border-gold-500 text-navy-950 font-semibold"
                        : "bg-white border-gray-300 text-gray-700"
                    }`}
                  >
                    {b.name}
                    <span className={active ? "text-navy-900/70" : "text-gray-400"}>{b.count}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="hidden lg:flex lg:w-56 shrink-0 flex-col gap-6">
          {siblings.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Type de pièce</h3>
              <ul className="space-y-1">
                {siblings.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/catalogue/${family.slug}/${s.slug}`}
                      className={`block px-2 rounded-lg text-sm min-h-tap flex items-center ${
                        subfamily?.slug === s.slug
                          ? "bg-navy-900 text-white font-semibold"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {brands.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Marque</h3>
              <ul className="space-y-1">
                {brands.map((b) => (
                  <li key={b.slug}>
                    <Link
                      href={`${basePath}?brand=${activeBrandSlug === b.slug ? "" : b.slug}${activeSort ? `&sort=${activeSort}` : ""}`}
                      className={`flex items-center justify-between px-2 rounded-lg text-sm min-h-tap ${
                        activeBrandSlug === b.slug ? "bg-gold-500/20 text-navy-900 font-semibold" : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span>{b.name}</span>
                      <span className="text-xs text-gray-400">{b.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className="flex-1 min-w-0">
          <CatalogControls basePath={basePath} activeBrandSlug={activeBrandSlug} activeSort={activeSort} />

          {products.length === 0 ? (
            <EmptyState whatsapp={whatsapp} />
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ whatsapp }: { whatsapp: string }) {
  return (
    <div className="text-center py-16 px-4 border border-dashed border-gray-300 rounded-xl">
      <p className="text-3xl mb-3">🔧</p>
      <p className="text-gray-600 font-medium mb-4">Aucune référence en ligne pour cette catégorie</p>
      <a
        href={`https://wa.me/${whatsapp}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold"
      >
        Envoyez-la sur WhatsApp, on la retrouve
      </a>
    </div>
  );
}
