import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";

/**
 * The admin dashboard, counted in Postgres.
 *
 * It used to be `order.findMany({ include: { items: true } })` with no window
 * and no take, plus `product.findMany({ include: { category, brand } })` the
 * same way — every order, every line of every order and every product, loaded
 * into Node on every view of /admin so that JavaScript could add them up.
 * That is the busiest page the shop has: it is the first thing opened in the
 * morning and the tab left sitting there all day. And it shares a database and
 * a connection pool with every shopper on the site.
 *
 * Same numbers, same shape, none of the rows. Each figure below is an
 * aggregate or a bounded read, and the two lists the page actually prints
 * (`recentOrders`, `lowStock`) take the eight rows it prints and no more.
 *
 * The totals are deliberately still all-time. They were all-time before and
 * the dashboard says so; narrowing them to a window to make the query cheaper
 * would have quietly changed what the page means, which is not a performance
 * fix, it is a different page.
 */
export async function getDashboardData() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const chartFrom = new Date(startOfToday);
  chartFrom.setDate(chartFrom.getDate() - 6);

  const num = (v: unknown) => (v == null ? 0 : Number(v));

  const [
    orderTotals,
    periodRow,
    dayRows,
    topRows,
    productRow,
    lowStock,
    recentOrders,
    customers,
    sourceRows,
    checkoutStarted7d,
    checkoutCompleted7d,
  ] = await Promise.all([
    // Revenue, count and the pending pile in one pass over the index.
    prisma.$queryRaw<{ revenue: unknown; orders: bigint; pending: bigint }[]>`
      SELECT COALESCE(SUM("total") FILTER (WHERE "status" <> 'CANCELLED'), 0) AS revenue,
             COUNT(*)::bigint AS orders,
             COUNT(*) FILTER (WHERE "status" = 'PENDING')::bigint AS pending
      FROM "Order"
    `,

    // Today, this week, this month — three windows, one scan.
    prisma.$queryRaw<
      { d_rev: unknown; d_ord: bigint; w_rev: unknown; w_ord: bigint; m_rev: unknown; m_ord: bigint }[]
    >`
      SELECT
        COALESCE(SUM("total") FILTER (WHERE "createdAt" >= ${startOfToday}), 0) AS d_rev,
        COUNT(*) FILTER (WHERE "createdAt" >= ${startOfToday})::bigint AS d_ord,
        COALESCE(SUM("total") FILTER (WHERE "createdAt" >= ${startOfWeek}), 0) AS w_rev,
        COUNT(*) FILTER (WHERE "createdAt" >= ${startOfWeek})::bigint AS w_ord,
        COALESCE(SUM("total") FILTER (WHERE "createdAt" >= ${startOfMonth}), 0) AS m_rev,
        COUNT(*) FILTER (WHERE "createdAt" >= ${startOfMonth})::bigint AS m_ord
      FROM "Order"
      WHERE "status" <> 'CANCELLED' AND "createdAt" >= ${startOfMonth < startOfWeek ? startOfMonth : startOfWeek}
    `,

    // The seven-day strip, with empty days filled in rather than skipped.
    prisma.$queryRaw<{ day: Date; revenue: unknown; count: bigint }[]>`
      SELECT d::date AS day, COALESCE(o.revenue, 0) AS revenue, COALESCE(o.count, 0)::bigint AS count
      FROM generate_series(${chartFrom}::date, ${startOfToday}::date, '1 day') AS d
      LEFT JOIN (
        SELECT date_trunc('day', "createdAt")::date AS day, SUM("total") AS revenue, COUNT(*) AS count
        FROM "Order"
        WHERE "createdAt" >= ${chartFrom} AND "status" <> 'CANCELLED'
        GROUP BY 1
      ) o ON o.day = d::date
      ORDER BY day ASC
    `,

    prisma.$queryRaw<{ name: string; qty: bigint; revenue: unknown }[]>`
      SELECT oi."name", SUM(oi."qty")::bigint AS qty, SUM(oi."lineTotal") AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."status" <> 'CANCELLED'
      GROUP BY oi."name"
      ORDER BY SUM(oi."lineTotal") DESC
      LIMIT 5
    `,

    // Catalogue totals, including the margin sitting on the shelf.
    prisma.$queryRaw<{ total: bigint; out_of_stock: bigint; low: bigint; margin: unknown }[]>`
      SELECT COUNT(*)::bigint AS total,
             COUNT(*) FILTER (WHERE "stockQty" <= 0)::bigint AS out_of_stock,
             COUNT(*) FILTER (WHERE "stockQty" > 0 AND "stockQty" <= "lowStockThreshold")::bigint AS low,
             COALESCE(SUM(("priceSell" - "priceBuy") * GREATEST("stockQty", 0)), 0) AS margin
      FROM "Product"
    `,

    // The eight rows the page prints, not the catalogue.
    prisma.product.findMany({
      where: { stockQty: { lte: prisma.product.fields.lowStockThreshold } },
      orderBy: { stockQty: "asc" },
      take: 8,
      include: { category: true, brand: true },
    }),

    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { items: true },
    }),

    prisma.user.count({ where: { role: "CUSTOMER" } }),

    prisma.$queryRaw<{ source: string | null; revenue: unknown; orders: bigint }[]>`
      SELECT "source", SUM("total") AS revenue, COUNT(*)::bigint AS orders
      FROM "Order"
      WHERE "status" <> 'CANCELLED'
      GROUP BY "source"
      ORDER BY SUM("total") DESC
    `,

    prisma.analyticsEvent.count({ where: { name: "checkout_started", createdAt: { gte: since7d } } }),
    prisma.analyticsEvent.count({ where: { name: "checkout_completed", createdAt: { gte: since7d } } }),
  ]);

  const revenue = num(orderTotals[0]?.revenue);
  const orderCount = Number(orderTotals[0]?.orders ?? 0);
  const avgBasket = orderCount > 0 ? revenue / orderCount : 0;
  const pendingCount = Number(orderTotals[0]?.pending ?? 0);

  const last7Days = dayRows.map((r) => ({
    label: r.day.toLocaleDateString("fr-FR", { weekday: "short" }),
    revenue: num(r.revenue),
    count: Number(r.count),
  }));

  const topProducts = topRows.map((r) => ({ name: r.name, qty: Number(r.qty), revenue: num(r.revenue) }));

  const p = periodRow[0];
  const periods = {
    today: { revenue: num(p?.d_rev), orders: Number(p?.d_ord ?? 0) },
    week: { revenue: num(p?.w_rev), orders: Number(p?.w_ord ?? 0) },
    month: { revenue: num(p?.m_rev), orders: Number(p?.m_ord ?? 0) },
  };

  // Orders placed before attribution shipped have source=null; group them
  // with real "direct" traffic rather than as a separate "unknown" bucket —
  // to a business owner these both just mean "not a tracked campaign," and
  // two similarly-named rows read as a bug, not two real segments. Folded
  // here rather than in SQL because that is where the two keys meet.
  const bySource = new Map<string, { revenue: number; orders: number }>();
  for (const r of sourceRows) {
    const key = r.source || "direct";
    const existing = bySource.get(key) ?? { revenue: 0, orders: 0 };
    existing.revenue += num(r.revenue);
    existing.orders += Number(r.orders);
    bySource.set(key, existing);
  }
  const revenueBySource = [...bySource.entries()]
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  const outOfStock = Number(productRow[0]?.out_of_stock ?? 0);
  const criticalLowStock = Number(productRow[0]?.low ?? 0);
  const abandonedCheckouts7d = Math.max(0, checkoutStarted7d - checkoutCompleted7d);

  const alerts: { level: "critical" | "warning" | "opportunity" | "success"; text: string }[] = [];
  if (outOfStock > 0) alerts.push({ level: "critical", text: `${outOfStock} produit(s) en rupture de stock` });
  if (criticalLowStock > 0) alerts.push({ level: "warning", text: `${criticalLowStock} produit(s) sous le seuil de stock` });
  if (abandonedCheckouts7d > 0) {
    alerts.push({ level: "warning", text: `${abandonedCheckouts7d} commande(s) démarrée(s) sans être finalisées (7j)` });
  }
  if (periods.week.orders > 0 && revenueBySource.length > 0) {
    const top = revenueBySource[0];
    if (top.source !== "direct" && top.revenue / (periods.week.revenue || 1) > 0.3) {
      alerts.push({ level: "opportunity", text: `${top.source} a généré ${Math.round((top.revenue / (revenue || 1)) * 100)}% du revenu total` });
    }
  }

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
    totalMargin: num(productRow[0]?.margin),
    productCount: Number(productRow[0]?.total ?? 0),
    periods,
    revenueBySource,
    alerts,
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
    // COUNT(DISTINCT) in Postgres. This was `findMany({ distinct: ["sessionId"] })`
    // with no `take`, which pulls every session id of the last thirty days into
    // Node in order to call `.length` on the array — unbounded work on the
    // busiest table in the schema, on a database the storefront is also using.
    prisma.$queryRaw<{ sessions: bigint }[]>`
      SELECT COUNT(DISTINCT "sessionId") AS sessions
      FROM "AnalyticsEvent"
      WHERE "createdAt" >= ${since}
    `,
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
    uniqueSessions: Number(sessionRows[0]?.sessions ?? 0),
    whatsappClicks: funnelStep("whatsapp_clicked"),
    byName: byName.map((r) => ({ name: r.name, count: r._count._all })).sort((a, b) => b.count - a.count),
    funnel,
    topSearches: topJsonValues(searchRows, "query"),
    topProductsViewed: topJsonValues(productViewRows, "slug"),
    topCategoriesViewed: topJsonValues(categoryViewRows, "family"),
  };
}
