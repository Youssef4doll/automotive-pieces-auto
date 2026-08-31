import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, getProductsForCategory, getBrandsForCategory } from "@/lib/data/catalog";
import { getSettings, publicContact } from "@/lib/settings";
import CatalogView from "@/components/CatalogView";
import { pageMeta, clampDescription } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, itemListSchema } from "@/lib/schema";

type Sort = "popularity" | "price-asc" | "price-desc";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ family: string; subfamily: string }>;
}): Promise<Metadata> {
  const { family, subfamily } = await params;
  const category = await getCategoryBySlug(subfamily);
  if (!category) return { title: "Catégorie introuvable" };

  return pageMeta({
    title: `${category.name} — ${category.parent?.name ?? "Pièces auto"}`,
    description: clampDescription(
      `${category.name} compatibles avec votre véhicule. Références vérifiées, livraison 24h ` +
        `Grand Tunis et 48–72h en régions, paiement à la livraison.`,
    ),
    path: `/catalogue/${family}/${category.slug}`,
  });
}

export default async function SubfamilyPage({
  params,
  searchParams,
}: {
  params: Promise<{ family: string; subfamily: string }>;
  searchParams: Promise<{ brand?: string; sort?: string }>;
}) {
  const { family, subfamily } = await params;
  const { brand, sort } = await searchParams;

  const category = await getCategoryBySlug(subfamily);
  if (!category || !category.parent || category.parent.slug !== family) notFound();

  const [products, brands, settings] = await Promise.all([
    getProductsForCategory(category.id, { brandSlug: brand || undefined, sort: sort as Sort | undefined }),
    getBrandsForCategory(category.id, false),
    getSettings(),
  ]);

  const siblingCategory = await getCategoryBySlug(family);

  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: category.parent!.name, path: `/catalogue/${category.parent!.slug}` },
    { name: category.name, path: `/catalogue/${category.parent!.slug}/${category.slug}` },
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
      family={{ name: category.parent.name, slug: category.parent.slug }}
      subfamily={{ name: category.name, slug: category.slug }}
      siblings={(siblingCategory?.children ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug, productCount: c._count.products }))}
      products={products}
      brands={brands}
      activeBrandSlug={brand}
      activeSort={sort}
      whatsapp={publicContact(settings).whatsapp}
    />
    </>
  );
}
