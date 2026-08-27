import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getProductBySlug, getRelatedProducts } from "@/lib/data/catalog";
import Price from "@/components/Price";
import ProductActions from "@/components/ProductActions";
import ProductGrid from "@/components/ProductGrid";

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

  const related = await getRelatedProducts(product.categoryId, product.id, 4);

  const outOfStock = product.stockQty <= 0;
  const lowStock = !outOfStock && product.stockQty <= product.lowStockThreshold;
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.priceSell
      ? Math.round((1 - product.priceSell / product.compareAtPrice) * 100)
      : null;

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

      <nav className="text-xs text-gray-500 mb-4 flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-navy-900">Accueil</Link>
        <span>›</span>
        {product.category.parent && (
          <>
            <Link href={`/catalogue/${product.category.parent.slug}`} className="hover:text-navy-900">
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
          className="hover:text-navy-900"
        >
          {product.category.name}
        </Link>
      </nav>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="relative aspect-square bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
          <Image src={product.imageUrl} alt={product.name} fill className="object-cover" priority />
          {discount && (
            <span className="absolute top-3 end-3 bg-red-600 text-white text-xs font-bold px-2.5 py-1.5 rounded">
              -{discount}%
            </span>
          )}
        </div>

        <div>
          {product.brand && (
            <span className="text-xs font-bold text-gray-400 uppercase">{product.brand.name}</span>
          )}
          <h1 className="text-xl sm:text-2xl font-extrabold text-navy-950 mt-1 mb-2">{product.name}</h1>
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

      <div className="grid md:grid-cols-2 gap-8 mt-10">
        <section>
          <h2 className="font-bold text-navy-950 mb-2">Description</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{product.description}</p>

          {product.oemRefs.length > 0 && (
            <>
              <h2 className="font-bold text-navy-950 mt-6 mb-2">Références OEM</h2>
              <p className="text-sm text-gray-700">{product.oemRefs.join(", ")}</p>
            </>
          )}
        </section>

        <section>
          <h2 className="font-bold text-navy-950 mb-2">Compatibilité véhicules</h2>
          {product.fitments.length === 0 ? (
            <p className="text-sm text-gray-500">Compatibilité universelle / non spécifiée — contactez-nous pour vérifier.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-start px-3 py-2">Marque</th>
                    <th className="text-start px-3 py-2">Modèle</th>
                    <th className="text-start px-3 py-2">Motorisation</th>
                  </tr>
                </thead>
                <tbody>
                  {product.fitments.map((f, i) => (
                    <tr key={f.id} className={i % 2 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-3 py-2">{f.engine.model.make.name}</td>
                      <td className="px-3 py-2">{f.engine.model.name}</td>
                      <td className="px-3 py-2">{f.engine.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {product.reviews.length > 0 && (
        <section className="mt-10">
          <h2 className="font-bold text-navy-950 mb-3">Avis clients</h2>
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
          <h2 className="font-bold text-navy-950 mb-3">Produits similaires</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
