import { notFound } from "next/navigation";
import ProductGallery from "@/components/ProductGallery";
import Link from "next/link";
import type { Metadata } from "next";
import { getProductBySlug, getRelatedProducts } from "@/lib/data/catalog";
import { getSettings } from "@/lib/settings";
import Price from "@/components/Price";
import ProductActions from "@/components/ProductActions";
import ProductGrid from "@/components/ProductGrid";
import TrackEvent from "@/components/TrackEvent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description.slice(0, 155),
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [related, settings] = await Promise.all([
    getRelatedProducts(product.categoryId, product.id, 4),
    getSettings(),
  ]);

  const outOfStock = product.stockQty <= 0;
  const lowStock = !outOfStock && product.stockQty <= product.lowStockThreshold;
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.priceSell
      ? Math.round((1 - product.priceSell / product.compareAtPrice) * 100)
      : null;

  // `specs` is a free-form JSON bag; `packContents` is a structured field used
  // only by PackCard to render bundle line items, not a human-readable spec —
  // exclude it here so we don't print raw JSON into the specs grid.
  const specEntries = Object.entries((product.specs as Record<string, unknown>) ?? {}).filter(
    ([key]) => key !== "packContents"
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    description: product.description,
    offers: {
      "@type": "Offer",
      priceCurrency: "TND",
      price: product.priceSell,
      availability: outOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <TrackEvent
        name="product_viewed"
        properties={{ slug: product.slug, sku: product.sku, category: product.category.slug, price: product.priceSell }}
      />

      <nav className="text-xs text-gray-500 mb-4 flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-navy-900 inline-flex items-center min-h-tap -my-2">Accueil</Link>
        <span>›</span>
        {product.category.parent && (
          <>
            <Link href={`/catalogue/${product.category.parent.slug}`} className="hover:text-navy-900 inline-flex items-center min-h-tap -my-2">
              {product.category.parent.name}
            </Link>
            <span>›</span>
          </>
        )}
        <Link
          href={
            product.category.parent
              ? `/catalogue/${product.category.parent.slug}/${product.category.slug}`
              : `/catalogue/${product.category.slug}`
          }
          className="hover:text-navy-900 inline-flex items-center min-h-tap -my-2"
        >
          {product.category.name}
        </Link>
      </nav>

      <div className="grid md:grid-cols-2 gap-8">
        <ProductGallery
          images={
            product.gallery.length > 0
              ? product.gallery
              : [{ src: product.imageUrl, alt: product.name }]
          }
          name={product.name}
          discount={discount}
        />

        <div>
          {product.brand && (
            <span className="text-xs font-bold text-gray-400 uppercase">{product.brand.name}</span>
          )}
          <h1 className="text-xl sm:text-2xl font-heading font-extrabold uppercase text-navy-950 mt-1 mb-2 tracking-tight">{product.name}</h1>
          <p className="text-xs text-gray-400 mb-3">Réf. {product.sku}</p>

          <div className="flex items-baseline gap-3 mb-3">
            {product.compareAtPrice && product.compareAtPrice > product.priceSell && (
              <Price value={product.compareAtPrice} className="text-gray-400 line-through" />
            )}
            <Price value={product.priceSell} className="text-2xl font-extrabold text-navy-900" />
          </div>

          <div className="mb-4">
            {outOfStock ? (
              <span className="text-sm text-red-600 font-semibold">Rupture de stock</span>
            ) : lowStock ? (
              <span className="text-sm text-amber-600 font-semibold">⚠ Stock limité · {product.stockQty} disponible(s)</span>
            ) : (
              <span className="text-sm text-green-700 font-semibold">● En stock · prête aujourd&rsquo;hui</span>
            )}
          </div>

          <ProductActions
            whatsapp={settings.shop_whatsapp}
            product={{
              id: product.id,
              slug: product.slug,
              sku: product.sku,
              name: product.name,
              imageUrl: product.imageUrl,
              priceSell: product.priceSell,
              stockQty: product.stockQty,
              fitmentEngineIds: product.fitments.map((f) => f.engineId),
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-8 mt-10 max-w-3xl">
        <section>
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 mb-2">Description</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{product.description}</p>
        </section>

        {specEntries.length > 0 && (
          <section>
            <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 mb-3">Caractéristiques</h2>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {specEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="flex justify-between gap-3 text-sm bg-gray-50 rounded-lg px-3.5 py-2.5 border border-gray-100"
                >
                  <span className="text-gray-500">{key}</span>
                  <span className="font-semibold text-navy-950">{String(value)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {product.oemRefs.length > 0 && (
          <section>
            <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 mb-2">Références OEM</h2>
            <p className="text-sm font-mono text-gray-700">{product.oemRefs.join(" · ")}</p>
          </section>
        )}
      </div>

      <section className="mt-8">
        <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 mb-3">Compatibilité véhicules</h2>
        {product.fitments.length === 0 ? (
          <p className="text-sm text-gray-500">Compatibilité universelle / non spécifiée — contactez-nous pour vérifier.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            {/* table-fixed: with auto layout the table expands to its content
                min-width and pushes past the overflow-x-auto wrapper, making
                the whole product page scroll sideways on a 320px phone.
                Fixed layout splits the three columns evenly and wraps long
                model names instead — better here than sideways scrolling. */}
            <table className="w-full table-fixed text-sm">
              <thead className="bg-navy-950 text-white/70">
                <tr>
                  <th className="text-start px-4 py-2.5 font-display font-bold uppercase text-[11px] tracking-wider">Marque</th>
                  <th className="text-start px-4 py-2.5 font-display font-bold uppercase text-[11px] tracking-wider">Modèle</th>
                  <th className="text-start px-4 py-2.5 font-display font-bold uppercase text-[11px] tracking-wider">Motorisation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {product.fitments.map((f, i) => (
                  <tr key={f.id} className={i % 2 ? "bg-white" : "bg-gray-50/60"}>
                    <td className="px-4 py-2.5 font-semibold text-navy-900">{f.engine.model.make.name}</td>
                    <td className="px-4 py-2.5">{f.engine.model.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{f.engine.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {product.reviews.length > 0 && (
        <section className="mt-10">
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 mb-3">Avis clients</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {product.reviews.map((r) => (
              <div key={r.id} className="p-4 rounded-xl border border-gray-200 bg-white">
                <div className="flex text-gold-500 text-sm mb-1.5">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                <p className="text-sm text-gray-700 mb-2">&ldquo;{r.comment}&rdquo;</p>
                <p className="text-xs font-semibold text-navy-900">{r.authorName}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 mb-3">Produits similaires</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
