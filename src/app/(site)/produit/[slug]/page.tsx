import { notFound, permanentRedirect } from "next/navigation";
import ProductGallery from "@/components/ProductGallery";
import FitConfidence from "@/components/FitConfidence";
import Link from "next/link";
import type { Metadata } from "next";
import { getProductBySlug, getRelatedProducts, getProductSlugRedirect } from "@/lib/data/catalog";
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
import { getCurrentUser } from "@/lib/session";
import { hasPurchased } from "@/app/actions/reviews";
import ReviewForm from "@/components/ReviewForm";
import FitmentBrowser, { type FitmentRow } from "@/components/product/FitmentBrowser";
import FitNotice from "@/components/product/FitNotice";
import OeNumbers from "@/components/product/OeNumbers";
import ManufacturerInfo from "@/components/product/ManufacturerInfo";
import { hasManufacturerInfo } from "@/lib/manufacturer";
import { engineSpecLine } from "@/lib/engine";

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
  if (!product) {
    // The part may simply have been renamed. A permanent redirect keeps the
    // link that is already in Google and in customers' WhatsApp threads.
    const moved = await getProductSlugRedirect(slug);
    if (moved) permanentRedirect(`/produit/${moved}`);
    notFound();
  }

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
  // Who may write one: a signed-in customer with a delivered order containing
  // this exact part, who has not already reviewed it. Checked again inside
  // submitReview — this only decides whether to render the form.
  const viewer = await getCurrentUser();
  const canReview =
    viewer !== null &&
    !product.reviews.some((r) => r.userId === viewer.id) &&
    (await hasPurchased(viewer.id, product.id));

  const reviewCount = product.reviews.length;
  const ratingAverage =
    reviewCount > 0 ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : null;

  // The compatibility list, flattened once: one row per engine, carrying the
  // links and the spec line the browser renders. Built here rather than in the
  // client component so the phone is not sent a nested fitment tree to walk.
  const fitmentRows: FitmentRow[] = product.fitments.map((f) => ({
    makeName: f.engine.model.make.name,
    makeSlug: f.engine.model.make.slug,
    modelName: f.engine.model.name,
    modelSlug: f.engine.model.slug,
    engineId: f.engineId,
    engineName: f.engine.name,
    engineSpec: engineSpecLine(f.engine),
    derived: f.confidence === "DERIVED",
  }));

  // The makes this part is listed for, named at the top. "Compatible avec
  // Renault, Dacia, Nissan" answers in one line the question the whole
  // compatibility section answers in thirty, and it is the line that decides
  // whether somebody scrolls to the section at all.
  const compatibleMakes = [...new Set(fitmentRows.map((r) => r.makeName))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );

  const showManufacturer = !!product.brand && hasManufacturerInfo(product.brand);

  // The sections this particular part has — never a fixed menu, because a
  // link to a heading that is not on the page is worse than no link.
  const sections = [
    { id: "description", label: "Description" },
    specEntries.length > 0 && { id: "caracteristiques", label: "Caractéristiques" },
    { id: "vehicules", label: "Compatibilité" },
    (product.oeGroups.length > 0 || product.aftermarketRefs.length > 0) && {
      id: "references-oe",
      label: "Références",
    },
    showManufacturer && { id: "fabricant", label: "Fabricant" },
    (product.reviews.length > 0 || canReview) && { id: "avis", label: "Avis" },
  ].filter((s): s is { id: string; label: string } => !!s);

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
    <div className="mx-auto shell-w px-4 py-6">
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
            <span className="text-xs font-bold text-gray-600 uppercase">{product.brand.name}</span>
          )}
          <h1 className="text-xl sm:text-2xl font-heading font-extrabold uppercase text-navy-950 mt-1 mb-2 tracking-tight">{product.name}</h1>
          <p className="text-xs text-gray-600 mb-3">Réf. {product.sku}</p>

          {/* Named makes rather than a count: "compatible avec 14 véhicules"
              tells a shopper nothing about whether one of them is theirs.
              Six, then a link into the full list — a paragraph of forty
              manufacturers is read by nobody and pushes the price off a
              phone screen. */}
          {compatibleMakes.length > 0 && (
            <p className="text-sm text-gray-600 mb-3 leading-relaxed">
              <span className="font-semibold text-navy-950">Compatible avec </span>
              {compatibleMakes.slice(0, 6).join(", ")}
              {compatibleMakes.length > 6 && <> et {compatibleMakes.length - 6} autre(s)</>}{" "}
              <Link
                href="#vehicules"
                className="text-navy-600 hover:text-red-600 underline underline-offset-2"
              >
                voir la liste
              </Link>
            </p>
          )}

          <div className="flex items-baseline gap-3 mb-3">
            {product.compareAtPrice && product.compareAtPrice > product.priceSell && (
              <Price value={product.compareAtPrice} className="text-gray-600 line-through" />
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

      {/* Where the rest of the page is. The page has grown several sections
          deep — compatibility, OE numbers, the manufacturer — and on a phone
          that is a long scroll to find out whether the one you came for is
          even here. Only the sections this part actually has are listed, so
          the strip never points at an empty anchor. */}
      {sections.length >= 3 && (
        <nav aria-label="Sections de la fiche" className="mt-8 max-w-3xl">
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {sections.map((sec) => (
              <li key={sec.id}>
                <a
                  href={`#${sec.id}`}
                  className="inline-flex min-h-tap-compact items-center rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-semibold text-navy-800 hover:border-navy-900"
                >
                  {sec.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="flex flex-col gap-8 mt-6 max-w-3xl">
        <section id="description" className="scroll-mt-24">
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 mb-2">Description</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{product.description}</p>
        </section>

        {specEntries.length > 0 && (
          <section id="caracteristiques" className="scroll-mt-24">
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
                  <Price value={item.price} className="shrink-0 text-gray-600" />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Which cars, and what "compatible" is actually worth.
            The two belong together: a list that names your car reads as a
            guarantee, and the note underneath is the only thing on the page
            that says what it really is. */}
        <section id="vehicules" className="scroll-mt-24">
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 mb-3">Compatibilité véhicules</h2>
          {fitmentRows.length === 0 ? (
            <p className="text-sm text-gray-500 mb-3">
              Compatibilité universelle / non spécifiée — contactez-nous pour vérifier.
            </p>
          ) : (
            <div className="mb-3">
              <FitmentBrowser rows={fitmentRows} />
            </div>
          )}
          <FitNotice />
        </section>

        <OeNumbers
          groups={product.oeGroups}
          other={product.aftermarketRefs}
          title={product.name}
        />

        {showManufacturer && product.brand && (
          <ManufacturerInfo name={product.brand.name} info={product.brand} />
        )}

        {/* The question this page could not answer.
            It goes to the shop's own inbox rather than to a phone, with the
            reference already attached and the subject already chosen — and
            the car too, if the shopper has told us. A question that arrives
            saying which part it is about is a question that can be answered
            once instead of after two rounds of "which one?". */}
        <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950">
            Une question sur cette pièce ?
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Écrivez-nous : la référence {product.sku} part avec votre message, et votre véhicule
            aussi si vous l&apos;avez indiqué.
          </p>
          <Link
            href={`/contact?ref=${encodeURIComponent(product.sku)}&sujet=${encodeURIComponent("Compatibilité d'une pièce")}`}
            className="mt-3 inline-flex min-h-tap items-center rounded-xl border border-navy-900/20 bg-white px-4 font-display text-xs font-bold uppercase tracking-wide text-navy-900 hover:border-gold-500"
          >
            Poser une question
          </Link>
        </section>
      </div>

      {/* Reviews, and the way to leave one.

          The section renders when there is either something to read or
          somebody entitled to write — never as an empty "0 avis" panel, which
          reads as a shop nobody buys from. */}
      {(product.reviews.length > 0 || canReview) && (
        <section id="avis" className="mt-10 scroll-mt-24">
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 mb-3">Avis clients</h2>

          {product.reviews.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-4">
              {product.reviews.map((r) => (
                <div key={r.id} className="p-4 rounded-xl border border-gray-200 bg-white">
                  <div className="flex text-gold-500 text-sm mb-1.5">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                  <p className="text-sm text-gray-700 mb-2">&ldquo;{r.comment}&rdquo;</p>
                  <p className="text-xs font-semibold text-navy-900">
                    {r.authorName}
                    {/* Said because it is true and checked, not as a badge:
                        only a delivered order of this exact part sets it. */}
                    {r.verified && <span className="ms-2 font-normal text-green-700">Achat vérifié</span>}
                  </p>
                </div>
              ))}
            </div>
          )}

          {canReview && (
            <div className={product.reviews.length > 0 ? "mt-4" : ""}>
              <ReviewForm productId={product.id} />
            </div>
          )}
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
