import "server-only";
import { prisma } from "@/lib/prisma";
import { serializeProduct, primaryImageSelect } from "./catalog";

/**
 * Pages about a car rather than about a part.
 *
 * "plaquettes de frein clio 4" is how people search, and until now the site
 * had no page that answered it — only a generic category and a search box.
 * These build one per model the shop can actually supply, from the fitment
 * data it already holds.
 *
 * The rule throughout: a page exists only when there are real products behind
 * it. A thousand empty "parts for X" pages is the well-known way to teach a
 * search engine that a site is hollow, and to waste a customer's tap.
 */

export type VehicleFamily = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
};

export async function getVehicleModel(makeSlug: string, modelSlug: string) {
  return prisma.vehicleModel.findFirst({
    where: { slug: modelSlug, make: { slug: makeSlug } },
    include: {
      make: true,
      engines: { orderBy: { name: "asc" } },
    },
  });
}

/** Part families with at least one part verified to fit this model. */
export async function getFamiliesForModel(modelId: string): Promise<VehicleFamily[]> {
  const rows = await prisma.$queryRaw<{ id: string; name: string; slug: string; n: bigint }[]>`
    SELECT fam.id, fam.name, fam.slug, COUNT(DISTINCT p.id) AS n
    FROM "ProductFitment" f
    JOIN "VehicleEngine" e ON e.id = f."engineId" AND e."modelId" = ${modelId}
    JOIN "Product" p ON p.id = f."productId" AND p.active
    JOIN "Category" c ON c.id = p."categoryId"
    JOIN "Category" fam ON fam.id = COALESCE(c."parentId", c.id)
    GROUP BY fam.id, fam.name, fam.slug
    ORDER BY n DESC, fam.name ASC
  `;
  return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, productCount: Number(r.n) }));
}

/** Parts verified to fit this model, optionally within one family. */
export async function getProductsForModel(modelId: string, familySlug?: string, take = 24) {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      fitments: { some: { engine: { modelId } } },
      ...(familySlug
        ? {
            category: {
              OR: [{ slug: familySlug }, { parent: { slug: familySlug } }],
            },
          }
        : {}),
    },
    include: { brand: true, category: true, fitments: { select: { engineId: true } }, ...primaryImageSelect },
    orderBy: [{ isTopSeller: "desc" }, { stockQty: "desc" }, { priceSell: "asc" }],
    take,
  });
  return products.map(serializeProduct);
}

/**
 * Every make/model that has parts, for the sitemap and for internal links.
 *
 * Returned with the count so callers can decide what deserves a link; a model
 * with two parts is worth a page but not worth a slot on the home page.
 */
export async function listVehiclePages() {
  const rows = await prisma.$queryRaw<
    { makeSlug: string; makeName: string; modelSlug: string; modelName: string; n: bigint }[]
  >`
    SELECT mk.slug AS "makeSlug", mk.name AS "makeName",
           md.slug AS "modelSlug", md.name AS "modelName",
           COUNT(DISTINCT p.id) AS n
    FROM "ProductFitment" f
    JOIN "VehicleEngine" e ON e.id = f."engineId"
    JOIN "VehicleModel" md ON md.id = e."modelId"
    JOIN "VehicleMake" mk ON mk.id = md."makeId"
    JOIN "Product" p ON p.id = f."productId" AND p.active
    GROUP BY mk.slug, mk.name, md.slug, md.name
    HAVING COUNT(DISTINCT p.id) > 0
    ORDER BY n DESC
  `;
  return rows.map((r) => ({ ...r, productCount: Number(r.n) }));
}

/** Model/family pairs with products — the deepest pages worth indexing. */
export async function listVehicleFamilyPages() {
  const rows = await prisma.$queryRaw<
    { makeSlug: string; modelSlug: string; familySlug: string; n: bigint }[]
  >`
    SELECT mk.slug AS "makeSlug", md.slug AS "modelSlug", fam.slug AS "familySlug",
           COUNT(DISTINCT p.id) AS n
    FROM "ProductFitment" f
    JOIN "VehicleEngine" e ON e.id = f."engineId"
    JOIN "VehicleModel" md ON md.id = e."modelId"
    JOIN "VehicleMake" mk ON mk.id = md."makeId"
    JOIN "Product" p ON p.id = f."productId" AND p.active
    JOIN "Category" c ON c.id = p."categoryId"
    JOIN "Category" fam ON fam.id = COALESCE(c."parentId", c.id)
    GROUP BY mk.slug, md.slug, fam.slug
    HAVING COUNT(DISTINCT p.id) > 0
  `;
  return rows.map((r) => ({ ...r, productCount: Number(r.n) }));
}

/**
 * The models a given part is verified to fit, grouped for display.
 *
 * Used both by the product page's compatibility table and by its internal
 * links: a part page that links to the cars it fits, and car pages that link
 * back to the parts, is the entire internal-link structure this catalogue
 * needs.
 */
export async function getModelsForProduct(productId: string) {
  const fitments = await prisma.productFitment.findMany({
    where: { productId },
    include: {
      engine: { include: { model: { include: { make: true } } } },
    },
  });

  const byModel = new Map<
    string,
    { makeName: string; makeSlug: string; modelName: string; modelSlug: string; engines: string[] }
  >();
  for (const f of fitments) {
    const m = f.engine.model;
    const key = `${m.make.slug}/${m.slug}`;
    const entry = byModel.get(key) ?? {
      makeName: m.make.name,
      makeSlug: m.make.slug,
      modelName: m.name,
      modelSlug: m.slug,
      engines: [],
    };
    if (!entry.engines.includes(f.engine.name)) entry.engines.push(f.engine.name);
    byModel.set(key, entry);
  }
  return [...byModel.values()].sort((a, b) =>
    `${a.makeName} ${a.modelName}`.localeCompare(`${b.makeName} ${b.modelName}`),
  );
}
