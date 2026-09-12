import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { pageMeta, clampDescription } from "@/lib/seo";
import { getCategoryBySlug, getProductsForCategory, getBrandsForCategory, getCategoryFacets } from "@/lib/data/catalog";
import { priceNote } from "@/lib/tax";
import { getSettings, publicContact } from "@/lib/settings";
import { parseFilters } from "@/lib/catalog-filters";
import CatalogView from "@/components/CatalogView";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, itemListSchema } from "@/lib/schema";

type Sort = "popularity" | "price-asc" | "price-desc";
type Search = { brand?: string; sort?: string; min?: string; max?: string; stock?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ family: string }>;
}): Promise<Metadata> {
  const { family } = await params;
  const category = await getCategoryBySlug(family);
  if (!category) return { title: "Famille introuvable" };

  const subs = category.children.map((c) => c.name).slice(0, 4).join(", ");
  return pageMeta({
    title: `${category.name} — pièces auto en Tunisie`,
    description: clampDescription(
      `${category.name} pour votre véhicule${subs ? ` : ${subs}` : ""}. Compatibilité vérifiée, ` +
        `livraison 24h Grand Tunis et paiement à la livraison.`,
    ),
    // Deliberately the bare family URL. Brand, price and sort filters produce
    // many URLs for one set of parts, and each would otherwise be indexed as a
    // separate thin page.
    path: `/catalogue/${category.slug}`,
  });
}

export default async function FamilyPage({
  params,
  searchParams,
}: {
  params: Promise<{ family: string }>;
  searchParams: Promise<Search>;
}) {
  const { family } = await params;
  const filters = parseFilters(await searchParams);

  const category = await getCategoryBySlug(family);
  if (!category || category.parentId) notFound();

  const [products, brands, facets, settings] = await Promise.all([
    getProductsForCategory(category.id, {
      includeDescendants: true,
      brandSlugs: filters.brands,
      sort: filters.sort as Sort | undefined,
      minPrice: filters.min,
      maxPrice: filters.max,
      inStockOnly: filters.stock,
    }),
    getBrandsForCategory(category.id, true),
    getCategoryFacets(category.id, true),
    getSettings(),
  ]);

  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: category.name, path: `/catalogue/${category.slug}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      {/* The parts on this page, in the order shown. Declared only when the
          page actually lists some — an empty ItemList says nothing. */}
      {products.length > 0 && (
        <JsonLd data={itemListSchema(products.map((p) => ({ name: p.name, path: `/produit/${p.slug}` })))} />
      )}
      <CatalogView
        family={{ name: category.name, slug: category.slug }}
        siblings={category.children.map((c) => ({ id: c.id, name: c.name, slug: c.slug, productCount: c._count.products }))}
        products={products}
        brands={brands}
        filters={filters}
        facets={facets}
        art={{ slug: category.slug, imageUrl: category.imageUrl }}
        delivery={{ grandTunis: settings.delivery_grand_tunis, regions: settings.delivery_regions }}
        priceNote={priceNote(settings)}
        whatsapp={publicContact(settings).whatsapp}
      />
    </>
  );
}
