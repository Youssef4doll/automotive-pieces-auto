import Link from "next/link";
import ProductGrid from "./ProductGrid";
import CatalogControls from "./CatalogControls";
import CatalogVehicleBar from "./CatalogVehicleBar";
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav className="text-xs text-gray-500 mb-3 flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-navy-900">Accueil</Link>
        <span>›</span>
        <Link href={`/catalogue/${family.slug}`} className="hover:text-navy-900">{family.name}</Link>
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

      <CatalogVehicleBar />

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-56 shrink-0 flex flex-col gap-6">
          {siblings.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Type de pièce</h3>
              <ul className="space-y-1">
                {siblings.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/catalogue/${family.slug}/${s.slug}`}
                      className={`block px-2 py-2 rounded-lg text-sm min-h-10 flex items-center ${
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
                      className={`flex items-center justify-between px-2 py-2 rounded-lg text-sm min-h-10 ${
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
