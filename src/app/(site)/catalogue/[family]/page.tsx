import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, getProductsForCategory, getBrandsForCategory } from "@/lib/data/catalog";
import { getSettings } from "@/lib/settings";
import CatalogView from "@/components/CatalogView";

type Sort = "popularity" | "price-asc" | "price-desc";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ family: string }>;
}): Promise<Metadata> {
  const { family } = await params;
  const category = await getCategoryBySlug(family);
  if (!category) return {};
  return { title: category.name };
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

  return (
    <CatalogView
      family={{ name: category.name, slug: category.slug }}
      siblings={category.children.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
      products={products}
      brands={brands}
      activeBrandSlug={brand}
      activeSort={sort}
      whatsapp={settings.shop_whatsapp}
    />
  );
}
