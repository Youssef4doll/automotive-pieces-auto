import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";
import { listVehiclePages, listVehicleFamilyPages } from "@/lib/data/vehicles";
import { listIndexableReferences } from "@/lib/data/references";
import { listGuides } from "@/lib/data/guides";

/**
 * Rendered per request, not at build time.
 *
 * The catalogue changes from the admin without a deploy, so a sitemap frozen
 * at build time starts going stale the first time a part is added and never
 * recovers. Prerendering it also made `next build` open a database connection,
 * which turns a missing DATABASE_URL in the build environment into a failed
 * deployment rather than a page that simply renders on demand.
 */
export const dynamic = "force-dynamic";

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

  const guides = await listGuides();
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/guides`, changeFrequency: "monthly", priority: 0.6 },
    ...guides.map((g) => ({
      url: `${base}/guides/${g.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
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

  // Vehicle and reference pages are generated from fitment and reference data,
  // so the set grows with the catalogue and never contains a page with nothing
  // on it — listVehiclePages and listIndexableReferences both require at least
  // one live product before a URL exists at all.
  const [vehicles, vehicleFamilies, references] = await Promise.all([
    listVehiclePages(),
    listVehicleFamilyPages(),
    listIndexableReferences(),
  ]);

  const makePages: MetadataRoute.Sitemap = [...new Set(vehicles.map((v) => v.makeSlug))].map((slug) => ({
    url: `${base}/pieces/${slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const vehiclePages: MetadataRoute.Sitemap = vehicles.map((v) => ({
    url: `${base}/pieces/${v.makeSlug}/${v.modelSlug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const vehicleFamilyPages: MetadataRoute.Sitemap = vehicleFamilies.map((v) => ({
    url: `${base}/pieces/${v.makeSlug}/${v.modelSlug}/${v.familySlug}`,
    changeFrequency: "weekly" as const,
    // The highest-intent page the site has: a named part for a named car.
    priority: 0.85,
  }));

  const referencePages: MetadataRoute.Sitemap = references.map((r) => ({
    url: `${base}/reference/${r}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // Listed most valuable first, because of the cap below: if the catalogue
  // ever outgrows one file, the URLs that survive should be the ones that earn
  // the most — a part for a named car, then the part, then the number.
  const all = [
    ...staticPages,
    ...categoryPages,
    ...vehicleFamilyPages,
    ...productPages,
    ...vehiclePages,
    ...makePages,
    ...referencePages,
  ];

  // A sitemap over 50 000 URLs is rejected outright, so an invalid file is a
  // worse outcome than a truncated one. At the shop's present size this never
  // trims anything; when it starts to, the fix is to shard with Next's
  // generateSitemaps() rather than to raise this number.
  const MAX_URLS = 50_000;
  if (all.length > MAX_URLS) {
    console.warn(`[sitemap] ${all.length} URLs exceeds the 50 000 limit — truncating. Time to shard.`);
  }
  return all.slice(0, MAX_URLS);
}
