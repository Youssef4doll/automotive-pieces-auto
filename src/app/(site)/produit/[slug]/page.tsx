import { notFound } from "next/navigation";
import ProductGallery from "@/components/ProductGallery";
import FitConfidence from "@/components/FitConfidence";
import Link from "next/link";
import type { Metadata } from "next";
import { getProductBySlug, getRelatedProducts } from "@/lib/data/catalog";
import { getSettings, publicContact } from "@/lib/settings";
import Price from "@/components/Price";
import ProductActions from "@/components/ProductActions";
import ProductGrid from "@/components/ProductGrid";
import TrackEvent from "@/components/TrackEvent";
import JsonLd from "@/components/JsonLd";
import { pageMeta, clampDescription } from "@/lib/seo";
import { productSchema, breadcrumbSchema } from "@/lib/schema";
import Breadcrumbs from "@/components/Breadcrumbs";
import { toNumber } from "@/lib/money";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Pièce introuvable" };

  // Written to read as a search result rather than as a database row: the part,
  // the brand, the reference a shopper may be searching by, and the two facts
  // that decide the click — price and availability.
  const price = toNumber(product.priceSell);
  const brand = product.brand?.name ? `${product.brand.name} ` : "";
  const description = clampDescription(
    product.description ||
      `${brand}${product.name}, référence ${product.sku}. ${price.toFixed(2)} DT. ` +
        `Livraison 24h Grand Tunis, paiement à la livraison.`,
  );

  // The part's own photo makes a far better share card than the site's generic
  // one; fall back to the generic when the reference has not been shot yet.
  const photo = product.gallery?.[0]
    ? [{ url: product.gallery[0].src, alt: product.gallery[0].alt || product.name }]
    : undefined;

  // Vehicle context in the title, but only when it is true without
  // qualification. A part verified against one model can honestly say so and
  // wins the "plaquettes clio 4" search; the same title on a part that fits
  // eleven cars would be a claim the fitment data does not support, and would
  // send the wrong shoppers to the page.
  const models = new Set(
    product.fitments.map((f) => `${f.engine.model.make.name} ${f.engine.model.name}`),
  );
  const forOneCar = models.size === 1 ? ` pour ${[...models][0]}` : "";

  return pageMeta({
    title: `${brand}${product.name}${forOneCar} — ${product.sku}`,
    description,
    path: `/produit/${product.slug}`,
    images: photo,
    type: "article",
  });
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

  // `specs` is a free-form JSON bag; `packContents` is a structured field —
  // a list of SKUs rendered as its own "Dans le pack" section below, not a
  // human-readable spec — so exclude it rather than print raw JSON here.
  const specEntries = Object.entries((product.specs as Record<string, unknown>) ?? {}).filter(
    ([key]) => key !== "packContents"
  );

  // The trail, built once and used for both the visible breadcrumb and the
  // BreadcrumbList that tells a search engine where this page sits.
  const crumbs = [
    { name: "Accueil", path: "/" },
    ...(product.category.parent
      ? [{ name: product.category.parent.name, path: `/catalogue/${product.category.parent.slug}` }]
      : []),
    {
      name: product.category.name,
      path: product.category.parent
        ? `/catalogue/${product.category.parent.slug}/${product.category.slug}`
        : `/catalogue/${product.category.slug}`,
    },
    { name: product.name, path: `/produit/${product.slug}` },
  ];

  // Only real ratings are declared. With no reviews the field is absent
  // entirely rather than defaulted to five stars.
  const reviewCount = product.reviews.length;
  const ratingAverage =
    reviewCount > 0 ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : null;

  const jsonLd = productSchema({
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    brandName: product.brand?.name,
    price: toNumber(product.priceSell),
    inStock: !outOfStock,
    images: product.gallery.length ? product.gallery.map((g) => g.src) : [product.imageUrl],
    oemRefs: product.oemRefs,
    reviewCount,
    ratingAverage,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <TrackEvent
        name="product_viewed"
        properties={{ slug: product.slug, sku: product.sku, category: product.category.slug, price: product.priceSell }}
      />

      <Breadcrumbs items={crumbs} />


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

          <FitConfidence
            whatsapp={publicContact(settings).whatsapp}
            product={{
              name: product.name,
              sku: product.sku,
              fitmentEngineIds: product.fitments.map((f) => f.engineId),
              axle: product.axle,
              side: product.side,
              hasFitmentData: product.fitments.length > 0,
            }}
          />

          <ProductActions
            whatsapp={publicContact(settings).whatsapp}
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

        {product.packContents.length > 0 && (
          <section>
            <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 mb-3">Dans le pack</h2>
            <ul className="flex flex-col gap-1.5">
              {product.packContents.map((item) => (
                <li key={item.slug} className="flex justify-between items-center gap-3 text-sm">
                  <Link
                    href={`/produit/${item.slug}`}
                    className="flex items-center gap-2 min-w-0 text-navy-600 hover:text-red-600 hover:underline underline-offset-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                  <Price value={item.price} className="shrink-0 text-gray-400" />
                </li>
              ))}
            </ul>
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
                    <td className="px-4 py-2.5">
                      {/* Each row is a way into that car's own page: someone
                          checking whether this fits their Clio is one tap from
                          everything else the shop has for it. */}
                      <Link
                        href={`/pieces/${f.engine.model.make.slug}/${f.engine.model.slug}`}
                        className="text-navy-600 hover:text-red-600 hover:underline underline-offset-2"
                      >
                        {f.engine.model.name}
                      </Link>
                    </td>
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
