import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import type { BuyAgainItem } from "@/components/account/BuyAgain";

/**
 * What this customer has bought before, ready to buy again.
 *
 * Prices and stock are read live rather than taken from the order snapshot:
 * offering a part at last year's price, or one that is out of stock, turns a
 * one-tap repurchase into a disappointment.
 */
export async function getBuyAgain(userId: string, take = 6): Promise<BuyAgainItem[]> {
  const lines = await prisma.orderItem.findMany({
    where: { order: { userId, status: { not: "CANCELLED" } }, productId: { not: null } },
    orderBy: { order: { createdAt: "desc" } },
    select: { productId: true, order: { select: { createdAt: true } } },
    take: 120,
  });
  if (lines.length === 0) return [];

  const stats = new Map<string, { count: number; last: Date }>();
  for (const l of lines) {
    const id = l.productId!;
    const existing = stats.get(id);
    if (existing) {
      existing.count += 1;
      if (l.order.createdAt > existing.last) existing.last = l.order.createdAt;
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
        _sort: s.last.getTime(),
      };
    })
    // In stock first — a rail that opens with three out-of-stock parts is worse
    // than no rail at all — then most recently bought.
    .sort((a, b) => Number(b.stockQty > 0) - Number(a.stockQty > 0) || b._sort - a._sort)
    .slice(0, take)
    .map(({ _sort, ...item }) => item);
}
