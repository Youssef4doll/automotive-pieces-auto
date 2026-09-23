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
    {
      makeSlug: string; makeName: string; makeLogoUrl: string | null;
      modelSlug: string; modelName: string;
      yearFrom: number | null; yearTo: number | null;
      n: bigint;
    }[]
  >`
    SELECT mk.slug AS "makeSlug", mk.name AS "makeName", mk."logoUrl" AS "makeLogoUrl",
           md.slug AS "modelSlug", md.name AS "modelName",
           md."yearFrom" AS "yearFrom", md."yearTo" AS "yearTo",
           COUNT(DISTINCT p.id) AS n
    FROM "ProductFitment" f
    JOIN "VehicleEngine" e ON e.id = f."engineId"
    JOIN "VehicleModel" md ON md.id = e."modelId"
    JOIN "VehicleMake" mk ON mk.id = md."makeId"
    JOIN "Product" p ON p.id = f."productId" AND p.active
    GROUP BY mk.slug, mk.name, mk."logoUrl", md.slug, md.name, md."yearFrom", md."yearTo"
    HAVING COUNT(DISTINCT p.id) > 0
    ORDER BY n DESC
  `;
  return rows.map((r) => ({ ...r, productCount: Number(r.n) }));
}

/**
 * The makes the shop covers, deepest first.
 *
 * The home board used to list make+model pairs — "Peugeot 208", "Renault Clio
 * IV". That is the more precise route, and it is still one tap further on, but
 * it answered a question nobody starts with: a shopper arrives knowing they
 * drive a Renault long before they can say which Clio. Makes first is how the
 * big parts catalogues lay this out, and it fits eighteen recognisable marks
 * on a screen where twelve model names took the same room.
 *
 * Counted the same way as everything else here: distinct active products with
 * a fitment against one of that make's engines. Never a popularity figure.
 */
export async function listVehicleMakePages() {
  const rows = await prisma.$queryRaw<
    { slug: string; name: string; logoUrl: string | null; models: bigint; n: bigint }[]
  >`
    SELECT mk.slug, mk.name, mk."logoUrl",
           COUNT(DISTINCT md.id) AS models,
           COUNT(DISTINCT p.id) AS n
    FROM "ProductFitment" f
    JOIN "VehicleEngine" e ON e.id = f."engineId"
    JOIN "VehicleModel" md ON md.id = e."modelId"
    JOIN "VehicleMake" mk ON mk.id = md."makeId"
    JOIN "Product" p ON p.id = f."productId" AND p.active
    GROUP BY mk.slug, mk.name, mk."logoUrl"
    HAVING COUNT(DISTINCT p.id) > 0
    ORDER BY n DESC, mk.name ASC
  `;
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    logoUrl: r.logoUrl,
    modelCount: Number(r.models),
    productCount: Number(r.n),
  }));
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

// ---------------------------------------------------------------------------
// The garage picker, one level at a time.
//
// `getVehicleMakes` in catalog.ts answers the same question in one payload —
// every make, with its models, with their engines — because the website's
// picker is a single client component that filters in the browser. That is the
// right trade on a desktop connection and the wrong one on a phone: the tree
// is the whole vehicle table, it grows with every car the shop learns about,
// and a shopper who opens the garage to pick Renault has been made to download
// Volkswagen. These three read one level each.
//
// They deliberately return every make, model and engine the shop knows — not
// only the ones with parts behind them. The catalogue's fitment coverage is
// thin, so filtering to "vehicles we have parts for" would empty a picker
// whose whole job is to find out what car the customer drives. The part count
// rides along so a screen can say what is behind a choice; it is never used to
// hide one.
// ---------------------------------------------------------------------------

export type PickerMake = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  modelCount: number;
  partCount: number;
};

export async function listPickerMakes(): Promise<PickerMake[]> {
  const [makes, counts] = await Promise.all([
    prisma.vehicleMake.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        _count: { select: { models: true } },
      },
    }),
    // Distinct parts per make, counted by Postgres. Counting in JS would mean
    // fetching ProductFitment in full — the compatibility table itself — to
    // produce one integer per manufacturer.
    prisma.$queryRaw<{ makeId: string; n: bigint }[]>`
      SELECT md."makeId" AS "makeId", COUNT(DISTINCT p.id) AS n
      FROM "ProductFitment" f
      JOIN "VehicleEngine" e ON e.id = f."engineId"
      JOIN "VehicleModel" md ON md.id = e."modelId"
      JOIN "Product" p ON p.id = f."productId" AND p.active
      GROUP BY md."makeId"
    `,
  ]);

  const parts = new Map(counts.map((c) => [c.makeId, Number(c.n)]));
  return makes.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    logoUrl: m.logoUrl,
    modelCount: m._count.models,
    partCount: parts.get(m.id) ?? 0,
  }));
}

export type PickerModel = {
  id: string;
  name: string;
  slug: string;
  yearFrom: number | null;
  yearTo: number | null;
  engineCount: number;
  partCount: number;
};

export async function listPickerModels(makeSlug: string): Promise<PickerModel[] | null> {
  const make = await prisma.vehicleMake.findUnique({
    where: { slug: makeSlug },
    select: { id: true },
  });
  // Null, not an empty list: "this make does not exist" and "this make has no
  // models recorded yet" are different answers and the screen says different
  // things about them.
  if (!make) return null;

  const [models, counts] = await Promise.all([
    prisma.vehicleModel.findMany({
      where: { makeId: make.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        yearFrom: true,
        yearTo: true,
        _count: { select: { engines: true } },
      },
    }),
    prisma.$queryRaw<{ modelId: string; n: bigint }[]>`
      SELECT e."modelId" AS "modelId", COUNT(DISTINCT p.id) AS n
      FROM "ProductFitment" f
      JOIN "VehicleEngine" e ON e.id = f."engineId"
      JOIN "VehicleModel" md ON md.id = e."modelId" AND md."makeId" = ${make.id}
      JOIN "Product" p ON p.id = f."productId" AND p.active
      GROUP BY e."modelId"
    `,
  ]);

  const parts = new Map(counts.map((c) => [c.modelId, Number(c.n)]));
  return models.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    yearFrom: m.yearFrom,
    yearTo: m.yearTo,
    engineCount: m._count.engines,
    partCount: parts.get(m.id) ?? 0,
  }));
}

export type PickerEngine = {
  id: string;
  name: string;
  fuel: string | null;
  powerHp: number | null;
  engineCode: string | null;
  displacementCc: number | null;
  /** The production years the shop recorded for this engine, when it did. */
  yearFrom: number | null;
  yearTo: number | null;
  partCount: number;
};

export async function listPickerEngines(
  makeSlug: string,
  modelSlug: string,
): Promise<PickerEngine[] | null> {
  const model = await prisma.vehicleModel.findFirst({
    where: { slug: modelSlug, make: { slug: makeSlug } },
    select: { id: true },
  });
  if (!model) return null;

  const [engines, counts] = await Promise.all([
    prisma.vehicleEngine.findMany({
      where: { modelId: model.id },
      orderBy: { name: "asc" },
      // The engine code and the displacement are what separate two engines a
      // brochure calls by the same name. Printed only where the shop recorded
      // them — most rows have neither, and the screen says less rather than
      // guessing from the name.
      select: {
        id: true,
        name: true,
        fuel: true,
        powerHp: true,
        engineCode: true,
        displacementCc: true,
        yearFrom: true,
        yearTo: true,
      },
    }),
    prisma.$queryRaw<{ engineId: string; n: bigint }[]>`
      SELECT f."engineId" AS "engineId", COUNT(DISTINCT p.id) AS n
      FROM "ProductFitment" f
      JOIN "VehicleEngine" e ON e.id = f."engineId" AND e."modelId" = ${model.id}
      JOIN "Product" p ON p.id = f."productId" AND p.active
      GROUP BY f."engineId"
    `,
  ]);

  const parts = new Map(counts.map((c) => [c.engineId, Number(c.n)]));
  return engines.map((e) => ({
    id: e.id,
    name: e.name,
    fuel: e.fuel,
    powerHp: e.powerHp,
    engineCode: e.engineCode,
    displacementCc: e.displacementCc,
    yearFrom: e.yearFrom,
    yearTo: e.yearTo,
    partCount: parts.get(e.id) ?? 0,
  }));
}
