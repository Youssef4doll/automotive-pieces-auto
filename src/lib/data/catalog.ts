import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import { normalizeReference } from "@/lib/reference";
import { parseQuery, rankProducts } from "@/lib/search";

/**
 * Navigation shows only what a shopper can actually buy.
 *
 * The category tree is deliberately larger than the catalogue: it describes the
 * whole trade and is filled in as stock arrives. Showing every branch made 77%
 * of taps land on an empty page, which reads as an abandoned shop rather than a
 * young one. Categories reappear on their own the moment they hold a product,
 * so this needs no maintenance as the catalogue grows.
 */
/**
 * @param includeEmpty Show families and subcategories that hold no parts yet.
 *
 * Off for shoppers: a tile that opens onto nothing is a dead end, and sixteen
 * of them is a catalogue that looks stocked and is not.
 *
 * On for an admin, because otherwise adding a category looks like it did
 * nothing. The category was created, it is in the admin list, and the home
 * page — the first place anyone checks — did not change, with no explanation
 * anywhere for why. The tile now appears for whoever is signed in as an admin,
 * marked as not yet visible to customers, so the answer to "did that work?" is
 * on the screen where the question gets asked.
 */
export async function getMegaMenu(includeEmpty = false) {
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

  return (
    families
      .map((f) => ({
        ...f,
        children: includeEmpty ? f.children : f.children.filter((c) => c._count.products > 0),
      }))
      .filter((f) => includeEmpty || f.children.length > 0 || f._count.products > 0)
      // How many parts are actually behind this tile — its own plus everything
      // in its subcategories. The number of subcategories told the shopper
      // about our filing system; the number of parts tells them whether it is
      // worth opening. Counted from the catalogue, never rounded up.
      .map((f) => ({
        ...f,
        productCount: f._count.products + f.children.reduce((n, c) => n + c._count.products, 0),
      }))
  );
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

/**
 * The seeded stand-in that every product shipped pointing at: the hero
 * artwork. It is a photograph of engine oil, an air filter and a spark plug,
 * so on a brake disc it is not a missing picture but a wrong one.
 */
const SEEDED_PLACEHOLDER = "/images/parts-lineup.png";

export function serializeProduct<
  T extends {
    priceBuy: unknown;
    priceSell: unknown;
    compareAtPrice: unknown;
    imageUrl?: string;
    images?: { id: string }[];
    searchText?: string;
    category?: { slug: string } | null;
  },
>(p: T) {
  // Uploaded photos win over the seeded static path, so a product that has
  // been given a real picture shows it everywhere — cards, cart, search,
  // packs — without each of those components knowing about ProductImage.
  const uploaded = p.images?.[0]?.id;
  // searchText is an index, not content: several hundred bytes per card that
  // no component reads. Dropped here rather than in every query's select, so
  // a new caller cannot forget and quietly double its page weight.
  const { images: _images, searchText: _searchText, ...rest } = p;

  // Nothing photographed yet: draw the family instead of showing a picture of
  // different parts. Only the seeded stand-in is replaced — a path the shop
  // typed itself is theirs and is left alone. The drawing needs the category,
  // so a query that did not ask for one keeps the old behaviour rather than
  // guessing at a family.
  const resolved = uploaded
    ? `/api/images/${uploaded}`
    : p.imageUrl === SEEDED_PLACEHOLDER && p.category?.slug
      ? `/api/part-icon/${p.category.slug}.svg`
      : p.imageUrl;

  return {
    ...rest,
    ...(p.imageUrl !== undefined ? { imageUrl: resolved } : {}),
    priceBuy: toNumber(p.priceBuy),
    priceSell: toNumber(p.priceSell),
    compareAtPrice: p.compareAtPrice ? toNumber(p.compareAtPrice) : null,
  };
}

export async function getProductsForCategory(
  categoryId: string,
  opts: {
    includeDescendants?: boolean;
    /** OR'd together — a checkbox filter, not a single choice. */
    brandSlugs?: string[];
    sort?: "popularity" | "price-asc" | "price-desc";
  } = {}
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
      ...(opts.brandSlugs?.length ? { brand: { slug: { in: opts.brandSlugs } } } : {}),
    },
    include: { brand: true, category: true, fitments: { select: { engineId: true } }, ...primaryImageSelect },
    orderBy,
  });

  // What can be bought comes first, whatever the sort.
  //
  // Freinage held eight parts with two of them in stock, and the order above
  // — top sellers, then newest — put six unbuyable ones at the top: the first
  // three things a customer saw in the brake aisle were all "Rupture de
  // stock". A part that cannot be bought is not a better answer than one that
  // can, and that holds when the shopper has asked for cheapest-first too,
  // which is why this sits outside the sort rather than inside it.
  //
  // Out-of-stock parts stay on the page. They are real references the shop
  // carries, they say plainly that they are out, and hiding them would lose
  // the customer who wants to know we stock the part at all. They just stop
  // going first.
  //
  // Sorted here rather than in the query because Prisma cannot order by an
  // expression, and a category holds tens of rows, not thousands.
  const ranked = [
    ...products.filter((p) => p.stockQty > 0),
    ...products.filter((p) => p.stockQty <= 0),
  ];
  return ranked.map(serializeProduct);
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
  // Every top seller is fetched and then cut down, rather than cut down by the
  // database: `take` on the query would hand back whichever rows came first,
  // and on the home page that meant "les pièces les plus commandées" could be
  // a row of parts nobody can order. Buyable ones fill the row first, and an
  // out-of-stock top seller only appears if there are not enough to fill it.
  const products = await prisma.product.findMany({
    where: { isTopSeller: true, active: true },
    include: { brand: true, category: true, fitments: { select: { engineId: true } }, ...primaryImageSelect },
  });
  const ranked = [
    ...products.filter((p) => p.stockQty > 0),
    ...products.filter((p) => p.stockQty <= 0),
  ];
  return ranked.slice(0, take).map(serializeProduct);
}

/**
 * The shop's search.
 *
 * Ranking lives in src/lib/search — this only hydrates the ids it returns and
 * puts them back in rank order, which Postgres cannot do for us once the rows
 * come back through Prisma's `in` filter.
 */
export async function searchProducts(query: string, take = 40) {
  const parsed = parseQuery(query);
  if (!parsed.folded) return [];

  const hits = await rankProducts(parsed, take);
  if (hits.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: hits.map((h) => h.id) } },
    include: { brand: true, category: true, fitments: { select: { engineId: true } }, ...primaryImageSelect },
  });

  const byId = new Map(products.map((p) => [p.id, p]));
  return hits
    .map((h) => {
      const p = byId.get(h.id);
      return p ? { ...serializeProduct(p), matchTier: h.tier } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
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

/**
 * Every make the shop covers, with how deeply it covers each one.
 *
 * `partCount` is the number of distinct active products that have a fitment row
 * against one of the make's engines — read out of the fitment table, not
 * estimated and not a popularity figure. It is what lets the picker put the
 * makes we can actually serve first, and say the number out loud, instead of
 * ordering ten manufacturers alphabetically and letting the shopper find out
 * after three taps that we hold nothing for theirs.
 *
 * Deliberately not a `groupBy`: a product fitting six engines of the same make
 * is one part, not six, and SQL would have to count distinct products across a
 * join. The table is small (about 1,200 rows) so the de-duplication is done
 * here, where it is obvious what is being counted.
 *
 * Only the fields the picker draws are selected — engine codes, displacements
 * and the rest are internal and would triple the payload of a request every
 * shopper makes.
 */
export async function getVehicleMakes() {
  const [makes, fitments] = await Promise.all([
    prisma.vehicleMake.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        models: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            yearFrom: true,
            yearTo: true,
            engines: {
              orderBy: { name: "asc" },
              select: { id: true, name: true, fuel: true, powerHp: true },
            },
          },
        },
      },
    }),
    prisma.productFitment.findMany({
      where: { product: { active: true } },
      select: { productId: true, engine: { select: { model: { select: { makeId: true } } } } },
    }),
  ]);

  const productsByMake = new Map<string, Set<string>>();
  for (const f of fitments) {
    const makeId = f.engine.model.makeId;
    let seen = productsByMake.get(makeId);
    if (!seen) productsByMake.set(makeId, (seen = new Set()));
    seen.add(f.productId);
  }

  return makes.map((m) => ({ ...m, partCount: productsByMake.get(m.id)?.size ?? 0 }));
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

/**
 * The subcategories the shop stocks most deeply.
 *
 * Used for the hero's shortcut chips. Ordered by how many live references
 * each holds — a fact the catalogue knows — rather than by a popularity
 * figure nobody has measured, and derived rather than hand-listed so the
 * chips cannot rot when the taxonomy moves.
 */
export async function getTopSubcategories(take = 3) {
  const rows = await prisma.category.findMany({
    where: { parentId: { not: null }, products: { some: { active: true } } },
    select: {
      name: true,
      slug: true,
      parent: { select: { slug: true } },
      _count: { select: { products: true } },
    },
  });
  return rows
    .sort((a, b) => b._count.products - a._count.products)
    .slice(0, take)
    .map((c) => ({
      label: c.name,
      href: c.parent ? `/catalogue/${c.parent.slug}/${c.slug}` : `/catalogue/${c.slug}`,
    }));
}

/**
 * The product a retired address used to point at.
 *
 * Renaming a part changes its slug, and every link already in Google, in a
 * WhatsApp thread with a customer, or in somebody's bookmarks still carries
 * the old one. The page checks here before giving up and redirects
 * permanently, so a correction to a product name never costs the shop the
 * traffic it had already earned.
 */
export async function getProductSlugRedirect(oldSlug: string) {
  const row = await prisma.productSlugHistory.findUnique({
    where: { slug: oldSlug },
    select: { product: { select: { slug: true, active: true } } },
  });
  if (!row?.product?.active) return null;
  return row.product.slug;
}
