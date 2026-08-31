import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import { looksLikeReference, normalizeReference } from "@/lib/reference";

/**
 * Navigation shows only what a shopper can actually buy.
 *
 * The category tree is deliberately larger than the catalogue: it describes the
 * whole trade and is filled in as stock arrives. Showing every branch made 77%
 * of taps land on an empty page, which reads as an abandoned shop rather than a
 * young one. Categories reappear on their own the moment they hold a product,
 * so this needs no maintenance as the catalogue grows.
 */
export async function getMegaMenu() {
  const families = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { order: "asc" },
    include: {
      children: {
        orderBy: { order: "asc" },
        include: { _count: { select: { products: true } } },
      },
      _count: { select: { products: true } },
    },
  });

  return families
    .map((f) => ({ ...f, children: f.children.filter((c) => c._count.products > 0) }))
    .filter((f) => f.children.length > 0 || f._count.products > 0);
}

/** The full tree, empty branches included — for the admin, never the storefront. */
export async function getFullCategoryTree() {
  return prisma.category.findMany({
    where: { parentId: null },
    orderBy: { order: "asc" },
    include: {
      children: { orderBy: { order: "asc" }, include: { _count: { select: { products: true } } } },
      _count: { select: { products: true } },
    },
  });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    include: {
      parent: true,
      // Counts come along so the storefront can hide subcategories that hold
      // nothing — see getMegaMenu for why.
      children: { orderBy: { order: "asc" }, include: { _count: { select: { products: true } } } },
    },
  });
}

/**
 * Include this in any product query whose result reaches the storefront: it is
 * what lets serializeProduct swap in the uploaded photo. Only the id is read,
 * so the image bytes never travel with the listing query.
 */
export const primaryImageSelect = {
  images: { orderBy: { order: "asc" }, take: 1, select: { id: true } },
} as const;

export function serializeProduct<
  T extends {
    priceBuy: unknown;
    priceSell: unknown;
    compareAtPrice: unknown;
    imageUrl?: string;
    images?: { id: string }[];
  },
>(p: T) {
  // Uploaded photos win over the seeded static path, so a product that has
  // been given a real picture shows it everywhere — cards, cart, search,
  // packs — without each of those components knowing about ProductImage.
  const uploaded = p.images?.[0]?.id;
  const { images: _images, ...rest } = p;
  return {
    ...rest,
    ...(p.imageUrl !== undefined ? { imageUrl: uploaded ? `/api/images/${uploaded}` : p.imageUrl } : {}),
    priceBuy: toNumber(p.priceBuy),
    priceSell: toNumber(p.priceSell),
    compareAtPrice: p.compareAtPrice ? toNumber(p.compareAtPrice) : null,
  };
}

export async function getProductsForCategory(
  categoryId: string,
  opts: { includeDescendants?: boolean; brandSlug?: string; sort?: "popularity" | "price-asc" | "price-desc" } = {}
) {
  let categoryIds = [categoryId];
  if (opts.includeDescendants) {
    const children = await prisma.category.findMany({ where: { parentId: categoryId }, select: { id: true } });
    categoryIds = [categoryId, ...children.map((c) => c.id)];
  }
  const orderBy =
    opts.sort === "price-asc"
      ? [{ priceSell: "asc" as const }]
      : opts.sort === "price-desc"
        ? [{ priceSell: "desc" as const }]
        : [{ isTopSeller: "desc" as const }, { createdAt: "desc" as const }];

  const products = await prisma.product.findMany({
    where: {
      categoryId: { in: categoryIds },
      active: true,
      ...(opts.brandSlug ? { brand: { slug: opts.brandSlug } } : {}),
    },
    include: { brand: true, category: true, fitments: { select: { engineId: true } }, ...primaryImageSelect },
    orderBy,
  });
  return products.map(serializeProduct);
}

export async function getBrandsForCategory(categoryId: string, includeDescendants = true) {
  let categoryIds = [categoryId];
  if (includeDescendants) {
    const children = await prisma.category.findMany({ where: { parentId: categoryId }, select: { id: true } });
    categoryIds = [categoryId, ...children.map((c) => c.id)];
  }
  const products = await prisma.product.findMany({
    where: { categoryId: { in: categoryIds }, active: true },
    select: { brand: true },
  });
  const counts = new Map<string, { name: string; slug: string; count: number }>();
  for (const p of products) {
    if (!p.brand) continue;
    const existing = counts.get(p.brand.slug);
    if (existing) existing.count += 1;
    else counts.set(p.brand.slug, { name: p.brand.name, slug: p.brand.slug, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

/**
 * Only used by the public product page, so it only ever returns a product the
 * shop is actually selling. Deactivating a part in the admin is how it is
 * withdrawn; without the `active` filter the page stayed up, kept its price on
 * screen and stayed in search results, and the shopper only discovered it was
 * gone when the checkout refused the order. The admin edits it through
 * /admin/stock, which reads the row directly.
 */
export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, active: true },
    include: {
      brand: true,
      category: { include: { parent: true } },
      fitments: { include: { engine: { include: { model: { include: { make: true } } } } } },
      reviews: { orderBy: { createdAt: "desc" }, take: 10 },
      // The product page shows a gallery, so it needs every photo, not just
      // the primary one the listings use.
      images: { orderBy: { order: "asc" }, select: { id: true, alt: true } },
    },
  });
  if (!product) return null;
  const gallery = product.images.map((i) => ({ src: `/api/images/${i.id}`, alt: i.alt }));
  return { ...serializeProduct(product), gallery, packContents: await resolvePackContents(product.specs) };
}

/**
 * A pack sells several parts as one line. `specs.packContents` holds their
 * SKUs, so the buyer can only see what they are getting if we look them up —
 * without this the page sells "Pack révision 15 000 km" and never says which
 * three parts are in the box.
 */
async function resolvePackContents(specs: unknown) {
  const skus = (specs as { packContents?: string[] } | null)?.packContents;
  if (!Array.isArray(skus) || skus.length === 0) return [];
  const parts = await prisma.product.findMany({
    where: { sku: { in: skus }, active: true },
    select: { sku: true, name: true, slug: true, priceSell: true },
  });
  const bySku = new Map(parts.map((p) => [p.sku, p]));
  // Listed in the order the pack declares, not the order Postgres returns.
  return skus
    .map((sku) => bySku.get(sku))
    .filter((p): p is (typeof parts)[number] => !!p)
    .map((p) => ({ name: p.name, slug: p.slug, price: toNumber(p.priceSell) }));
}

export async function getRelatedProducts(categoryId: string, excludeId: string, take = 4) {
  const products = await prisma.product.findMany({
    where: { categoryId, active: true, id: { not: excludeId } },
    include: { brand: true, fitments: { select: { engineId: true } }, ...primaryImageSelect },
    take,
  });
  return products.map(serializeProduct);
}

export async function getTopSellers(take = 8) {
  const products = await prisma.product.findMany({
    where: { isTopSeller: true, active: true },
    include: { brand: true, category: true, fitments: { select: { engineId: true } }, ...primaryImageSelect },
    take,
  });
  return products.map(serializeProduct);
}

export async function searchProducts(query: string, take = 20) {
  const q = query.trim();
  if (!q) return [];

  // A mechanic holding the broken part types the number stamped on it. That is
  // the highest-intent query in the business, so it is answered first and
  // exactly: an exact reference match outranks any fuzzy name match. If the
  // query only looked like a reference, this finds nothing and we fall through
  // to ordinary text search, which makes a false positive here harmless.
  if (looksLikeReference(q)) {
    const normalized = normalizeReference(q);
    const hits = await prisma.product.findMany({
      where: {
        active: true,
        OR: [
          { references: { some: { normalized } } },
          { sku: { equals: q, mode: "insensitive" } },
          { oemRefs: { has: q } },
        ],
      },
      include: { brand: true, category: true, fitments: { select: { engineId: true } }, ...primaryImageSelect },
      take,
    });
    if (hits.length > 0) return hits.map(serializeProduct);
  }

  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { references: { some: { normalized: { contains: normalizeReference(q) } } } },
      ],
    },
    include: { brand: true, category: true, fitments: { select: { engineId: true } }, ...primaryImageSelect },
    take,
  });
  return products.map(serializeProduct);
}

export async function findProductByReference(query: string) {
  const q = query.trim();
  if (!q) return null;
  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { references: { some: { normalized: normalizeReference(q) } } },
        { sku: { equals: q, mode: "insensitive" } },
        { oemRefs: { has: q } },
      ],
    },
    include: { category: true, ...primaryImageSelect },
  });
  return product;
}

export async function getPartsBrands() {
  return prisma.brand.findMany({ where: { isPartsBrand: true }, orderBy: { name: "asc" } });
}

export async function getVehicleMakes() {
  return prisma.vehicleMake.findMany({
    orderBy: { name: "asc" },
    include: { models: { orderBy: { name: "asc" }, include: { engines: { orderBy: { name: "asc" } } } } },
  });
}

/**
 * Banners for one surface of the home page.
 *
 * HERO is the strip at the very top; CAMPAIGN is the rotating band mid-page.
 * Both are edited from /admin/promotions and neither is faked: an empty
 * placement renders nothing at all rather than a placeholder.
 */
export async function getActivePromotions(placement: "HERO" | "CAMPAIGN" = "HERO") {
  return prisma.promotion.findMany({
    where: { active: true, placement },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, imageUrl: true, href: true, kind: true },
  });
}
