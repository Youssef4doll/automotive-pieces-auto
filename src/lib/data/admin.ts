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
