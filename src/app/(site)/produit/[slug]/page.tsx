import { notFound, permanentRedirect } from "next/navigation";
import ProductGallery from "@/components/ProductGallery";
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
import FitmentBrowser, { type FitmentRow } from "@/components/product/FitmentBrowser";
import FitNotice from "@/components/product/FitNotice";
import OeNumbers from "@/components/product/OeNumbers";
import ManufacturerInfo from "@/components/product/ManufacturerInfo";
import { hasManufacturerInfo } from "@/lib/manufacturer";
import { engineSpecLine } from "@/lib/engine";
import { availabilityView, AVAILABILITY_TONE } from "@/lib/availability";
import { positionLabels } from "@/lib/position";
import BrandMark from "@/components/product/BrandMark";
import TechnicalInfo, { type TechRow } from "@/components/product/TechnicalInfo";
import DeliveryNote from "@/components/product/DeliveryNote";

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
  //
  // The shop's own words come first when it has written any, and the facts are
  // added after them rather than instead of them. It used to be one or the
  // other, which meant a terse catalogue line — "Amortisseur arrière,
  // compatible Peugeot 208/308", 47 characters — became the whole meta
  // description, below the length this project holds itself to and well below
  // what a search result has room for. Nothing here is invented: every fact
  // appended is already on the page.
  const price = toNumber(product.priceSell);
  const brand = product.brand?.name ? `${product.brand.name} ` : "";
  const facts =
    `${brand}${product.name}, référence ${product.sku}. ${price.toFixed(2)} DT. ` +
    `Livraison 24h Grand Tunis, paiement à la livraison.`;
  const own = product.description.trim();
  const description = clampDescription(
    !own ? facts : own.length >= 110 ? own : `${own.replace(/[.\s]+$/, "")}. ${facts}`,
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

  const avail = availabilityView(product, settings.supplier_lead_time);
  const tone = AVAILABILITY_TONE[avail.state];
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.priceSell
      ? Math.round((1 - product.priceSell / product.compareAtPrice) * 100)
      : null;

  // `specs` is a free-form JSON bag; `packContents` is a structured field —
  // a list of SKUs rendered as its own "Dans le pack" section below, not a
  // human-readable spec — so exclude it rather than print raw JSON here.
  const specEntries = Object.entries((product.specs as Record<string, unknown>) ?? {}).filter(
    ([key]) => key !== "packContents",
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
  const position = positionLabels(product.axle, product.side);

  /**
   * The specification sheet, in two piles.
   *
   * The identity rows — what this part *is* — are always on screen; everything
   * else the shop has typed into the free-form spec bag goes behind a
   * disclosure. Both piles are built by dropping anything empty, so a thinly
   * described part shows three rows rather than eight labels with dashes after
   * them. The names are the ones a parts catalogue uses, and each maps to a
   * real column: nothing here is filled in from a guess.
   */
  const specBy = (...names: string[]) => {
    const hit = specEntries.find(([k]) =>
      names.some((n) => k.toLowerCase().replace(/[^a-z]/g, "") === n),
    );
    return hit ? String(hit[1]) : null;
  };
  const dimensions = specBy("dimensions", "dimension", "taille");
  const material = specBy("materiau", "matiere", "material");
  const partType = specBy("type", "typedepiece");

  const techRows: TechRow[] = [
    { label: "Référence", value: product.sku },
    product.brand && {
      label: "Fabricant",
      value: product.brand.name,
      href: `/marque/${product.brand.slug}`,
    },
    product.oemRefs.length > 0 && {
      label: "Référence OEM",
      value: product.oemRefs.slice(0, 2).join(" · ") + (product.oemRefs.length > 2 ? ` +${product.oemRefs.length - 2}` : ""),
      href: "#references-oe",
    },
    position.length > 0 && { label: "Position", value: position.join(" · ") },
    product.axle && { label: "Essieu", value: product.axle === "AVANT" ? "Avant" : "Arrière" },
    dimensions && { label: "Dimensions", value: dimensions },
    material && { label: "Matériau", value: material },
    partType && { label: "Type", value: partType },
    // The shop's standing warranty, the same twelve months the home page and
    // the checkout state. Not a per-part field, because there is no per-part
    // field — inventing one would make this row a promise nobody made.
    { label: "Garantie", value: "12 mois" },
  ].filter((r): r is TechRow => Boolean(r));

  const shown = new Set([dimensions, material, partType].filter(Boolean));
  const extraRows: TechRow[] = specEntries
    .filter(([, v]) => !shown.has(String(v)))
    .map(([k, v]) => ({ label: k, value: String(v) }));

  // The sections this particular part has — never a fixed menu, because a
  // link to a heading that is not on the page is worse than no link.
  const sections = [
    { id: "description", label: "Description" },
    (techRows.length > 0 || extraRows.length > 0) && { id: "technique", label: "Caractéristiques" },
    { id: "vehicules", label: "Compatibilité" },
    (product.oeGroups.length > 0 || product.aftermarketRefs.length > 0) && {
      id: "references-oe",
      label: "Références",
    },
    showManufacturer && { id: "fabricant", label: "Fabricant" },
  ].filter((s): s is { id: string; label: string } => !!s);

  const jsonLd = productSchema({
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    brandName: product.brand?.name,
    price: toNumber(product.priceSell),
    inStock: avail.buyable,
    images: product.gallery.length ? product.gallery.map((g) => g.src) : [product.imageUrl],
    oemRefs: product.oemRefs,
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


      {/*
        The order a phone reads this in is the order it is written in, and the
        order the brief asked for: brand, picture, name, compatibility, price,
        availability, buy. The old page opened on a full-width square image and
        then a paragraph of technical prose, so the price and the button were
        below the fold on every phone and the first thing anybody read about a
        part was its resolution and its refresh rate.

        Desktop is the same DOM placed differently — three grid children with
        explicit rows, rather than a second copy of the brand block. Duplicating
        it would mean two elements with the maker's name on one page, which is
        two things to keep in step and two matches for every selector.
      */}
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 md:items-start">
        {/* 1 — the maker, and a way into everything else it makes. */}
        <div className="md:col-start-2 md:row-start-1">
          {product.brand ? (
            <Link
              href={`/marque/${product.brand.slug}`}
              className="group inline-flex items-center gap-2.5 rounded-lg py-0.5 transition"
            >
              <BrandMark name={product.brand.name} logoUrl={product.brand.logoUrl} />
              <span className="inline-flex items-center gap-1 font-display text-[11px] font-bold uppercase tracking-wide text-navy-900/40 group-hover:text-red-600">
                Voir tout
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </span>
            </Link>
          ) : (
            <p className="font-display text-[11px] font-bold uppercase tracking-wide text-navy-900/40">
              {product.category.name}
            </p>
          )}
        </div>

        {/* 2 — the part. */}
        <div className="md:col-start-1 md:row-span-2 md:row-start-1">
          <ProductGallery
            images={
              product.gallery.length > 0
                ? product.gallery
                : [{ src: product.imageUrl, alt: product.name }]
            }
            name={product.name}
            discount={discount}
            badge={product.isTopSeller ? "Top vente" : null}
          />
        </div>

        {/* 3 — name, fit, price, availability, buy. */}
        {/* id, because this block is a destination: it is what "acheter"
            means on this page, and it is what the sticky bar on a phone is
            standing in for while it is off screen. */}
        <div id="acheter" className="flex flex-col gap-3.5 md:col-start-2 md:row-start-2">
          <div>
            <h1 className="font-heading text-xl font-extrabold uppercase leading-tight tracking-tight text-navy-950 sm:text-2xl">
              {product.name}
            </h1>
            {/* Named makes rather than a count: "compatible avec 14 véhicules"
                tells a shopper nothing about whether one of them is theirs.
                Six, then a link into the full list. */}
            {compatibleMakes.length > 0 && (
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
                <span className="font-semibold text-navy-950">Compatible avec </span>
                {compatibleMakes.slice(0, 6).join(", ")}
                {compatibleMakes.length > 6 && <> et {compatibleMakes.length - 6} autre(s)</>}{" "}
                <Link
                  href="#vehicules"
                  className="text-navy-600 underline underline-offset-2 hover:text-red-600"
                >
                  voir la liste
                </Link>
              </p>
            )}
          </div>

          {/* Price and availability on one row: they are the two facts that
              decide the purchase, they are both short, and separately they
              cost 100px of a 664px phone screen for eight words. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <Price value={product.priceSell} className="text-3xl font-extrabold text-navy-900" />
              {product.compareAtPrice && product.compareAtPrice > product.priceSell && (
                <Price value={product.compareAtPrice} className="text-sm text-gray-500 line-through" />
              )}
              {discount && (
                <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
                  -{discount}%
                </span>
              )}
            </div>

            {/* Three answers, not two — see lib/availability. */}
            <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 ${tone.chip}`}>
              <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
              <span className="text-sm font-semibold">{avail.label}</span>
            </div>
          </div>
          {avail.detail && <p className="-mt-2 text-xs text-gray-600">{avail.detail}</p>}

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
              supply: product.supply,
              fitmentEngineIds: product.fitments.map((f) => f.engineId),
              hasFitmentData: product.fitments.length > 0,
            }}
          />

          <DeliveryNote
            availability={avail.state}
            grandTunis={settings.delivery_grand_tunis}
            regions={settings.delivery_regions}
            freeShippingThreshold={Number(settings.free_shipping_threshold) || 150}
            leadTime={settings.supplier_lead_time}
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

        {/* The specification sheet, out of the way of the product. Eight rows
            that identify the part, and everything else behind a native
            <details> — see TechnicalInfo. This replaces a grid that printed
            every key of a free-form JSON bag at the same weight as the
            description, immediately under it. */}
        <TechnicalInfo rows={techRows} extra={extraRows} />

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

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-heading font-extrabold uppercase tracking-tight text-navy-950 mb-3">Produits similaires</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
