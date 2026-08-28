import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";

export async function getDashboardData() {
  const [orders, products, customers] = await Promise.all([
    prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ include: { category: true, brand: true } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
  ]);

  const revenue = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + toNumber(o.total), 0);
  const orderCount = orders.length;
  const avgBasket = orderCount > 0 ? revenue / orderCount : 0;
  const pendingCount = orders.filter((o) => o.status === "PENDING").length;

  const now = new Date();
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date(now);
    day.setDate(day.getDate() - (6 - i));
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const dayOrders = orders.filter((o) => o.createdAt >= day && o.createdAt < next && o.status !== "CANCELLED");
    return {
      label: day.toLocaleDateString("fr-FR", { weekday: "short" }),
      revenue: dayOrders.reduce((s, o) => s + toNumber(o.total), 0),
      count: dayOrders.length,
    };
  });

  const productSales = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const order of orders) {
    if (order.status === "CANCELLED") continue;
    for (const item of order.items) {
      const existing = productSales.get(item.name) ?? { name: item.name, qty: 0, revenue: 0 };
      existing.qty += item.qty;
      existing.revenue += toNumber(item.lineTotal);
      productSales.set(item.name, existing);
    }
  }
  const topProducts = [...productSales.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const lowStock = products
    .filter((p) => p.stockQty <= p.lowStockThreshold)
    .sort((a, b) => a.stockQty - b.stockQty)
    .slice(0, 8);

  const recentOrders = orders.slice(0, 8);

  const totalMargin = products.reduce(
    (sum, p) => sum + (toNumber(p.priceSell) - toNumber(p.priceBuy)) * Math.max(0, p.stockQty),
    0
  );

  return {
    revenue,
    orderCount,
    avgBasket,
    pendingCount,
    customerCount: customers,
    last7Days,
    topProducts,
    lowStock,
    recentOrders,
    totalMargin,
    productCount: products.length,
  };
}

// groupBy on a JSON `properties` field isn't portable across Prisma's
// query engines, so the handful of "top N by JSON property" breakdowns
// below just fetch the raw recent rows and aggregate in JS — perfectly
// fine at this stage's event volume, and simple to read.
export async function getAnalyticsData() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const where = { createdAt: { gte: since } };

  const [totalEvents, byName, sessionRows, searchRows, productViewRows, categoryViewRows] = await Promise.all([
    prisma.analyticsEvent.count({ where }),
    prisma.analyticsEvent.groupBy({ by: ["name"], where, _count: { _all: true } }),
    prisma.analyticsEvent.findMany({ where, select: { sessionId: true }, distinct: ["sessionId"] }),
    prisma.analyticsEvent.findMany({
      where: { ...where, name: "search_started" },
      select: { properties: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.analyticsEvent.findMany({
      where: { ...where, name: "product_viewed" },
      select: { properties: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.analyticsEvent.findMany({
      where: { ...where, name: "category_viewed" },
      select: { properties: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);

  const countByName = new Map(byName.map((r) => [r.name, r._count._all]));
  const funnelStep = (name: string) => countByName.get(name) ?? 0;
  const funnel = [
    { step: "Vue produit", key: "product_viewed", count: funnelStep("product_viewed") },
    { step: "Ajout au panier", key: "add_to_cart", count: funnelStep("add_to_cart") },
    { step: "Commande démarrée", key: "checkout_started", count: funnelStep("checkout_started") },
    { step: "Commande confirmée", key: "checkout_completed", count: funnelStep("checkout_completed") },
  ];

  function topJsonValues(rows: { properties: unknown }[], key: string, take = 8) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const props = row.properties as Record<string, unknown> | null;
      const value = props?.[key];
      if (typeof value !== "string" || !value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, take)
      .map(([value, count]) => ({ value, count }));
  }

  return {
    totalEvents,
    uniqueSessions: sessionRows.length,
    whatsappClicks: funnelStep("whatsapp_clicked"),
    byName: byName.map((r) => ({ name: r.name, count: r._count._all })).sort((a, b) => b.count - a.count),
    funnel,
    topSearches: topJsonValues(searchRows, "query"),
    topProductsViewed: topJsonValues(productViewRows, "slug"),
    topCategoriesViewed: topJsonValues(categoryViewRows, "family"),
  };
}
