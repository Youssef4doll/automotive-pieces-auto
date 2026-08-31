import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { pageMeta, clampDescription } from "@/lib/seo";
import { getCategoryBySlug, getProductsForCategory, getBrandsForCategory } from "@/lib/data/catalog";
import { getSettings, publicContact } from "@/lib/settings";
import CatalogView from "@/components/CatalogView";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, itemListSchema } from "@/lib/schema";

type Sort = "popularity" | "price-asc" | "price-desc";

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
    // Deliberately the bare family URL. Brand and sort filters produce many
    // URLs for one set of parts, and each would otherwise be indexed as a
    // separate thin page.
    path: `/catalogue/${category.slug}`,
  });
}

export default async function FamilyPage({
  params,
  searchParams,
}: {
  params: Promise<{ family: string }>;
  searchParams: Promise<{ brand?: string; sort?: string }>;
}) {
  const { family } = await params;
  const { brand, sort } = await searchParams;

  const category = await getCategoryBySlug(family);
  if (!category || category.parentId) notFound();

  const [products, brands, settings] = await Promise.all([
    getProductsForCategory(category.id, {
      includeDescendants: true,
      brandSlug: brand || undefined,
      sort: sort as Sort | undefined,
    }),
    getBrandsForCategory(category.id, true),
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
      activeBrandSlug={brand}
      activeSort={sort}
      whatsapp={publicContact(settings).whatsapp}
    />
    </>
  );
}
