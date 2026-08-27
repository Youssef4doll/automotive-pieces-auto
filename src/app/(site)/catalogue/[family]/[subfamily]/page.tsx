import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, getProductsForCategory, getBrandsForCategory } from "@/lib/data/catalog";
import { getSettings } from "@/lib/settings";
import CatalogView from "@/components/CatalogView";

type Sort = "popularity" | "price-asc" | "price-desc";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ family: string; subfamily: string }>;
}): Promise<Metadata> {
  const { subfamily } = await params;
  const category = await getCategoryBySlug(subfamily);
  if (!category) return {};
  return { title: category.name };
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

  return (
    <CatalogView
      family={{ name: category.parent.name, slug: category.parent.slug }}
      subfamily={{ name: category.name, slug: category.slug }}
      siblings={(siblingCategory?.children ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
      products={products}
      brands={brands}
      activeBrandSlug={brand}
      activeSort={sort}
      whatsapp={settings.shop_whatsapp}
    />
  );
}
