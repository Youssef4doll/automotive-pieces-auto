import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";

export async function getMegaMenu() {
  const families = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { order: "asc" },
    include: {
      children: { orderBy: { order: "asc" }, include: { _count: { select: { products: true } } } },
    },
  });
  return families;
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    include: { parent: true, children: { orderBy: { order: "asc" } } },
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

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
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
  return { ...serializeProduct(product), gallery };
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
  if (!query.trim()) return [];
  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
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
      OR: [{ sku: { equals: q, mode: "insensitive" } }, { oemRefs: { has: q } }],
    },
    include: { category: true, ...primaryImageSelect },
  });
  return product;
}

export async function getPacks() {
  const packs = await prisma.product.findMany({
    where: { sku: { startsWith: "PACK-" }, active: true },
    orderBy: { priceSell: "asc" },
    include: { ...primaryImageSelect },
  });

  const allContentSkus = packs.flatMap((p) => {
    const specs = p.specs as { packContents?: string[] } | null;
    return specs?.packContents ?? [];
  });
  const components = allContentSkus.length
    ? await prisma.product.findMany({ where: { sku: { in: allContentSkus } } })
    : [];
  const componentBySku = new Map(components.map((c) => [c.sku, c]));

  return packs.map((p) => {
    const specs = p.specs as { packContents?: string[] } | null;
    const contents = (specs?.packContents ?? [])
      .map((sku) => componentBySku.get(sku))
      .filter((c): c is (typeof components)[number] => !!c)
      .map((c) => ({ name: c.name, price: toNumber(c.priceSell) }));
    return { ...serializeProduct(p), contents };
  });
}

export async function getRecentReviews(take = 6) {
  return prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { product: { select: { name: true, slug: true } } },
  });
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

export async function getActivePromotions() {
  return prisma.promotion.findMany({
    where: { active: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, imageUrl: true, href: true },
  });
}
