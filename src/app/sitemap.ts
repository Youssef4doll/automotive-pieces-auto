import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";

/**
 * Only pages that deserve to be indexed. An empty category is a thin page that
 * costs crawl budget and teaches Google the site is hollow, so categories
 * appear here once they hold a product — the same rule the navigation uses.
 * The sitemap therefore grows on its own as the catalogue is loaded.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.category.findMany({
      select: {
        slug: true,
        parent: { select: { slug: true } },
        _count: { select: { products: true } },
        children: { select: { _count: { select: { products: true } } } },
      },
    }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/sources`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories
    .filter((c) => c._count.products > 0 || c.children.some((ch) => ch._count.products > 0))
    .map((c) => ({
      url: c.parent ? `${base}/catalogue/${c.parent.slug}/${c.slug}` : `${base}/catalogue/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: c.parent ? 0.7 : 0.8,
    }));

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/produit/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}
