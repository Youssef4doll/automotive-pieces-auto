import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import type { BuyAgainItem } from "@/components/account/BuyAgain";
import type { CategoryChip } from "@/components/account/ShopForCar";

/**
 * What this customer has bought before, ready to buy again.
 *
 * Prices, stock and fitments are read live rather than taken from the order
 * snapshot: offering a part at last year's price, out of stock, or claiming a
 * compatibility that has since changed turns a one-tap repurchase into a
 * disappointment.
 */
export async function getBuyAgain(userId: string, take = 6): Promise<BuyAgainItem[]> {
  const lines = await prisma.orderItem.findMany({
    where: { order: { userId, status: { not: "CANCELLED" } }, productId: { not: null } },
    orderBy: { order: { createdAt: "desc" } },
    select: { productId: true, order: { select: { createdAt: true } } },
    take: 150,
  });
  if (lines.length === 0) return [];

  const stats = new Map<string, { count: number; last: Date }>();
  for (const l of lines) {
    const id = l.productId!;
    const s = stats.get(id);
    if (s) {
      s.count += 1;
      if (l.order.createdAt > s.last) s.last = l.order.createdAt;
    } else {
      stats.set(id, { count: 1, last: l.order.createdAt });
    }
  }

  const products = await prisma.product.findMany({
    where: { id: { in: [...stats.keys()] }, active: true },
    select: {
      id: true, name: true, sku: true, slug: true, imageUrl: true,
      priceSell: true, stockQty: true,
      images: { orderBy: { order: "asc" }, take: 1, select: { id: true } },
      fitments: { select: { engineId: true } },
    },
  });

  return products
    .map((p) => {
      const s = stats.get(p.id)!;
      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        slug: p.slug,
        imageUrl: p.images[0] ? `/api/images/${p.images[0].id}` : p.imageUrl,
        unitPrice: toNumber(p.priceSell),
        stockQty: p.stockQty,
        timesBought: s.count,
        lastBought: s.last.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
        fitmentEngineIds: p.fitments.map((f) => f.engineId),
        _sort: s.last.getTime(),
      };
    })
    // In stock first — a rail opening with three out-of-stock parts is worse
    // than no rail — then most recently bought.
    .sort((a, b) => Number(b.stockQty > 0) - Number(a.stockQty > 0) || b._sort - a._sort)
    .slice(0, take)
    .map(({ _sort, ...item }) => item);
}

/**
 * Families that actually hold stock, for the "what are you looking for"
 * shortcuts. Empty categories are excluded so a shortcut never lands on a
 * dead end — the same rule the storefront navigation uses.
 */
export async function getShoppableFamilies(take = 8): Promise<CategoryChip[]> {
  const families = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { order: "asc" },
    select: {
      name: true,
      slug: true,
      _count: { select: { products: true } },
      children: { select: { _count: { select: { products: true } } } },
    },
  });

  return families
    .map((f) => ({
      name: f.name,
      slug: f.slug,
      count: f._count.products + f.children.reduce((s, c) => s + c._count.products, 0),
    }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, take)
    .map(({ name, slug }) => ({ name, slug }));
}

/** The customer's contact block, read from shop settings. */
export function contactFrom(settings: {
  shop_whatsapp: string; shop_phone: string; shop_email: string; shop_hours: string;
}) {
  return {
    whatsapp: settings.shop_whatsapp,
    phone: settings.shop_phone,
    email: settings.shop_email,
    hours: settings.shop_hours,
  };
}

/** Statuses that mean the order has stopped moving. */
const SETTLED = ["DELIVERED", "CANCELLED"];

/**
 * How many orders this customer has, and how many are still in flight.
 *
 * The two numbers say different things and are shown in different places: the
 * total is context on the navigation rail, while the in-flight count is the one
 * worth badging — it is the only one that asks the customer to do something.
 * One grouped query rather than two counts on every page that renders the shell.
 */
export async function getOrderCounts(userId: string) {
  const rows = await prisma.order.groupBy({
    by: ["status"],
    where: { userId },
    _count: { _all: true },
  });

  let total = 0;
  let active = 0;
  for (const r of rows) {
    total += r._count._all;
    if (!SETTLED.includes(r.status)) active += r._count._all;
  }
  return { total, active };
}
