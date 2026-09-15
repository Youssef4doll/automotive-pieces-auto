import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ANALYTICS_TAG, ANALYTICS_TTL } from "@/lib/cache";

/**
 * Everything /admin/analyse draws, in one cached read.
 *
 * **The constraint that shaped this file is that the shop's admin and the
 * shop's customers share a database.** A deep-analysis page is the easiest
 * place in an application to write a query that is fine on a laptop with two
 * hundred orders and takes the storefront down at fifty thousand. So three
 * rules are held throughout, and the suite measures them:
 *
 *  1. **Every query is bounded by a date window and by LIMIT.** Nothing here
 *     reads "all orders" or "all events". The windows are constants below.
 *  2. **Aggregation happens in Postgres, never in JavaScript.** The pattern
 *     this replaces — `findMany({ take: 1000 })` and then counting in a `Map`
 *     — moves a thousand JSON blobs across the wire to produce eight numbers,
 *     and silently answers a different question from the one asked ("top
 *     searches" becomes "top searches among the most recent thousand").
 *  3. **The whole thing is one cached unit.** Ten minutes, one tag. An admin
 *     leaving the page open costs six reads an hour instead of one per
 *     refresh, and a shopper never waits behind an analyst.
 *
 * Raw SQL rather than Prisma aggregates in several places, deliberately:
 * `date_trunc`, `COUNT(DISTINCT …)` and window functions have no Prisma
 * equivalent, and expressing them as `findMany` + JavaScript is precisely the
 * thing rule 2 forbids. Every one of them is parameterised through Prisma's
 * tagged template, so the values are bound, never interpolated.
 */

/** The trend window. Ninety days is three months of seasonality without
 *  turning any of these into a full-table read. */
const TREND_DAYS = 90;
/** The behavioural window. Events are the highest-volume table by far, so it
 *  is deliberately shorter than the order window. */
const EVENT_DAYS = 30;
/** Nothing in a "top N" panel is ever longer than this. */
const TOP_N = 10;

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

export type DayPoint = { day: string; orders: number; revenue: number };
export type Forecast =
  | { available: false; reason: string }
  | {
      available: true;
      /** Mean daily revenue the trend projects over the horizon. */
      dailyRevenue: number;
      /** Total over the horizon, and the band around it. */
      horizonDays: number;
      total: number;
      low: number;
      high: number;
      /** The fitted line's value today and at the end of the horizon, so the
       *  chart draws the trend it is actually projecting rather than a segment
       *  from the last real point down to an average. */
      fitToday: number;
      fitEnd: number;
      /** One standard deviation of the residuals — the cone's half-width at
       *  the far end, zero at today. */
      dailySd: number;
      /** How the number was reached, printed on the page. */
      method: string;
      /** Slope per day — positive is growth. */
      slopePerDay: number;
      basis: number;
    };

/**
 * A straight line through the daily revenue, and honest about it.
 *
 * Least squares on the day index, with the spread of the residuals as the
 * band. That is a deliberately unclever model: with a few dozen order-days
 * there is nothing to fit a seasonal model to, and a confident-looking curve
 * drawn through nine data points is a lie told with more arithmetic.
 *
 * It refuses to answer at all below `MIN_DAYS` days that actually had an
 * order. A shop opening its analytics in week one should be told there is not
 * enough history yet, not shown a projection built from three Tuesdays.
 */
const MIN_DAYS_FOR_FORECAST = 14;
const HORIZON_DAYS = 14;

export function forecastRevenue(series: DayPoint[]): Forecast {
  const withSales = series.filter((d) => d.revenue > 0);
  if (withSales.length < MIN_DAYS_FOR_FORECAST) {
    return {
      available: false,
      reason: `Pas encore assez d'historique : ${withSales.length} jour(s) avec au moins une commande, il en faut ${MIN_DAYS_FOR_FORECAST}.`,
    };
  }

  // Indexed on the position in the series, not on the calendar, so a day with
  // no orders is a real zero rather than a gap the line jumps over.
  const n = series.length;
  const xs = series.map((_, i) => i);
  const ys = series.map((d) => d.revenue);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  // The band is the spread of what the line got wrong on the days we already
  // know the answer to — which is the only honest source of an error bar here.
  const residuals = ys.map((y, i) => y - (intercept + slope * xs[i]));
  const sd = Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / Math.max(1, n - 2));

  let total = 0;
  for (let i = 0; i < HORIZON_DAYS; i++) {
    total += Math.max(0, intercept + slope * (n + i));
  }
  const band = sd * Math.sqrt(HORIZON_DAYS);

  return {
    available: true,
    dailyRevenue: total / HORIZON_DAYS,
    horizonDays: HORIZON_DAYS,
    total,
    low: Math.max(0, total - band),
    high: total + band,
    // Both ends read off the same fitted line. Drawing from the last *actual*
    // day to the horizon's *mean* is what made a rising trend render as a
    // cliff: the last real day was a spike, the mean of fourteen projected
    // days was far below it, and the chart showed a collapse the arithmetic
    // never said.
    fitToday: Math.max(0, intercept + slope * (n - 1)),
    fitEnd: Math.max(0, intercept + slope * (n + HORIZON_DAYS - 1)),
    dailySd: sd,
    slopePerDay: slope,
    basis: withSales.length,
    method: `Régression linéaire sur ${n} jours (${withSales.length} avec commande). La fourchette est l'écart-type des résidus — l'erreur que cette même droite fait sur les jours déjà connus.`,
  };
}

/* ------------------------------------------------------------------ reads */

type RawDay = { day: Date; orders: bigint; revenue: unknown };

async function readDeepAnalytics() {
  const trendSince = daysAgo(TREND_DAYS);
  const eventSince = daysAgo(EVENT_DAYS);

  const [
    dailyRaw,
    funnelRows,
    sessionRow,
    topProducts,
    acquisition,
    vehicles,
    fitRisk,
    governorates,
    customers,
    slowMovers,
  ] = await Promise.all([
    // Daily orders and revenue. `generate_series` fills the days nobody bought
    // anything, so a gap is a zero on the chart rather than a line that skips
    // a week and looks like growth.
    prisma.$queryRaw<RawDay[]>`
      SELECT d::date AS day,
             COALESCE(o.orders, 0)::bigint AS orders,
             COALESCE(o.revenue, 0) AS revenue
      FROM generate_series(${trendSince}::date, CURRENT_DATE, '1 day') AS d
      LEFT JOIN (
        SELECT date_trunc('day', "createdAt")::date AS day,
               COUNT(*) AS orders,
               SUM("total") AS revenue
        FROM "Order"
        WHERE "createdAt" >= ${trendSince} AND "status" <> 'CANCELLED'
        GROUP BY 1
      ) o ON o.day = d::date
      ORDER BY day ASC
    `,

    // One grouped count for the whole funnel, rather than one query per step.
    prisma.analyticsEvent.groupBy({
      by: ["name"],
      where: { createdAt: { gte: eventSince } },
      _count: { _all: true },
    }),

    // COUNT(DISTINCT) in Postgres. The page this replaces pulled every session
    // id of the last thirty days into Node to call `.length` on it.
    prisma.$queryRaw<{ sessions: bigint }[]>`
      SELECT COUNT(DISTINCT "sessionId") AS sessions
      FROM "AnalyticsEvent"
      WHERE "createdAt" >= ${eventSince}
    `,

    // What actually sold, by money rather than by units — a shop that ranks by
    // units puts washer fluid above brake discs.
    prisma.$queryRaw<
      { sku: string; name: string; units: bigint; revenue: unknown; margin: unknown; stock: number | null }[]
    >`
      SELECT oi."sku",
             MAX(oi."name") AS name,
             SUM(oi."qty")::bigint AS units,
             SUM(oi."lineTotal") AS revenue,
             SUM(oi."lineTotal" - (COALESCE(p."priceBuy", 0) * oi."qty")) AS margin,
             MAX(p."stockQty") AS stock
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      LEFT JOIN "Product" p ON p."id" = oi."productId"
      WHERE o."createdAt" >= ${trendSince} AND o."status" <> 'CANCELLED'
      GROUP BY oi."sku"
      ORDER BY SUM(oi."lineTotal") DESC
      LIMIT ${TOP_N}
    `,

    // First-touch attribution, already carried on every order. This is the
    // panel that answers "did that campaign pay for itself".
    prisma.$queryRaw<
      { source: string | null; medium: string | null; campaign: string | null; orders: bigint; revenue: unknown }[]
    >`
      SELECT "source", "medium", "campaign",
             COUNT(*)::bigint AS orders,
             SUM("total") AS revenue
      FROM "Order"
      WHERE "createdAt" >= ${trendSince} AND "status" <> 'CANCELLED'
      GROUP BY "source", "medium", "campaign"
      ORDER BY SUM("total") DESC
      LIMIT ${TOP_N}
    `,

    // Which cars the shop actually sells to — only possible since orders
    // started recording the vehicle.
    prisma.$queryRaw<{ vehicle: string; orders: bigint; revenue: unknown }[]>`
      SELECT "vehicleLabel" AS vehicle,
             COUNT(*)::bigint AS orders,
             SUM("total") AS revenue
      FROM "Order"
      WHERE "createdAt" >= ${trendSince} AND "status" <> 'CANCELLED' AND "vehicleLabel" IS NOT NULL
      GROUP BY "vehicleLabel"
      ORDER BY COUNT(*) DESC
      LIMIT ${TOP_N}
    `,

    // Orders carrying a line we hold no compatibility for. Each one is a
    // return waiting to happen, and a gap in the fitment table to fill.
    prisma.$queryRaw<{ ref: string; label: string | null; unlisted: bigint; createdAt: Date }[]>`
      SELECT o."ref", o."vehicleLabel" AS label,
             COUNT(*) FILTER (WHERE oi."fit" = 'UNLISTED')::bigint AS unlisted,
             o."createdAt"
      FROM "Order" o
      JOIN "OrderItem" oi ON oi."orderId" = o."id"
      WHERE o."createdAt" >= ${trendSince}
        AND o."status" NOT IN ('CANCELLED', 'DELIVERED')
        AND o."vehicleLabel" IS NOT NULL
      GROUP BY o."id", o."ref", o."vehicleLabel", o."createdAt"
      HAVING COUNT(*) FILTER (WHERE oi."fit" = 'UNLISTED') > 0
      ORDER BY o."createdAt" DESC
      LIMIT ${TOP_N}
    `,

    prisma.$queryRaw<{ governorate: string; orders: bigint; revenue: unknown }[]>`
      SELECT "governorate", COUNT(*)::bigint AS orders, SUM("total") AS revenue
      FROM "Order"
      WHERE "createdAt" >= ${trendSince} AND "status" <> 'CANCELLED'
      GROUP BY "governorate"
      ORDER BY COUNT(*) DESC
      LIMIT ${TOP_N}
    `,

    // New against returning, counted by account rather than guessed from a
    // name: an order is "returning" when its customer had an earlier one.
    prisma.$queryRaw<{ guests: bigint; first_time: bigint; returning: bigint }[]>`
      WITH ranked AS (
        SELECT "id", "userId",
               ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt") AS seq
        FROM "Order"
        WHERE "status" <> 'CANCELLED' AND "userId" IS NOT NULL
      )
      SELECT
        (SELECT COUNT(*) FROM "Order"
          WHERE "createdAt" >= ${trendSince} AND "status" <> 'CANCELLED' AND "userId" IS NULL)::bigint AS guests,
        (SELECT COUNT(*) FROM ranked r JOIN "Order" o ON o."id" = r."id"
          WHERE o."createdAt" >= ${trendSince} AND r.seq = 1)::bigint AS first_time,
        (SELECT COUNT(*) FROM ranked r JOIN "Order" o ON o."id" = r."id"
          WHERE o."createdAt" >= ${trendSince} AND r.seq > 1)::bigint AS returning
    `,

    // Money sitting on a shelf: in stock, active, and nothing sold in the
    // window. Bounded by stock value so it names the expensive mistakes.
    prisma.$queryRaw<{ sku: string; name: string; stock: number; tied: unknown }[]>`
      SELECT p."sku", p."name", p."stockQty" AS stock, (p."stockQty" * p."priceBuy") AS tied
      FROM "Product" p
      WHERE p."active" = true
        AND p."stockQty" > 0
        AND NOT EXISTS (
          SELECT 1 FROM "OrderItem" oi
          JOIN "Order" o ON o."id" = oi."orderId"
          WHERE oi."productId" = p."id" AND o."createdAt" >= ${trendSince} AND o."status" <> 'CANCELLED'
        )
      ORDER BY (p."stockQty" * p."priceBuy") DESC
      LIMIT ${TOP_N}
    `,
  ]);

  const num = (v: unknown) => (v == null ? 0 : Number(v));
  const daily: DayPoint[] = dailyRaw.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    orders: Number(r.orders),
    revenue: num(r.revenue),
  }));

  const eventCount = new Map(funnelRows.map((r) => [r.name, r._count._all]));
  const step = (name: string) => eventCount.get(name) ?? 0;
  const funnel = [
    { step: "Vue produit", count: step("product_viewed") },
    { step: "Ajout au panier", count: step("add_to_cart") },
    { step: "Commande démarrée", count: step("checkout_started") },
    { step: "Commande confirmée", count: step("checkout_completed") },
  ];

  const sold = topProducts.map((r) => ({
    sku: r.sku,
    name: r.name,
    units: Number(r.units),
    revenue: num(r.revenue),
    margin: num(r.margin),
    stock: r.stock ?? null,
    // Days of cover at the rate this part has actually been selling. Null
    // where the product is gone from the catalogue, because there is no shelf
    // to run out of.
    daysOfCover:
      r.stock == null || Number(r.units) === 0
        ? null
        : Math.round((r.stock / (Number(r.units) / TREND_DAYS)) * 10) / 10,
  }));

  const orders30 = daily.slice(-30).reduce((a, d) => a + d.orders, 0);
  const revenue30 = daily.slice(-30).reduce((a, d) => a + d.revenue, 0);
  const orders60to30 = daily.slice(-60, -30).reduce((a, d) => a + d.orders, 0);
  const revenue60to30 = daily.slice(-60, -30).reduce((a, d) => a + d.revenue, 0);

  // Zeroes as plain numbers, not BigInt literals: the project targets an
  // older lib than 0n needs, and `Number()` below accepts either.
  const cust = customers[0] ?? { guests: 0, first_time: 0, returning: 0 };

  return {
    windows: { trendDays: TREND_DAYS, eventDays: EVENT_DAYS, horizonDays: HORIZON_DAYS },
    daily,
    forecast: forecastRevenue(daily),
    kpis: {
      orders30,
      revenue30,
      ordersDelta: orders60to30 === 0 ? null : (orders30 - orders60to30) / orders60to30,
      revenueDelta: revenue60to30 === 0 ? null : (revenue30 - revenue60to30) / revenue60to30,
      aov: orders30 === 0 ? 0 : revenue30 / orders30,
      sessions: Number(sessionRow[0]?.sessions ?? 0),
    },
    funnel,
    sold,
    slowMovers: slowMovers.map((r) => ({ sku: r.sku, name: r.name, stock: r.stock, tied: num(r.tied) })),
    acquisition: acquisition.map((r) => ({
      source: r.source,
      medium: r.medium,
      campaign: r.campaign,
      orders: Number(r.orders),
      revenue: num(r.revenue),
    })),
    vehicles: vehicles.map((r) => ({ vehicle: r.vehicle, orders: Number(r.orders), revenue: num(r.revenue) })),
    fitRisk: fitRisk.map((r) => ({
      ref: r.ref,
      label: r.label,
      unlisted: Number(r.unlisted),
      createdAt: r.createdAt.toISOString(),
    })),
    governorates: governorates.map((r) => ({
      governorate: r.governorate,
      orders: Number(r.orders),
      revenue: num(r.revenue),
    })),
    customers: {
      guests: Number(cust.guests),
      firstTime: Number(cust.first_time),
      returning: Number(cust.returning),
    },
  };
}

export type DeepAnalytics = Awaited<ReturnType<typeof readDeepAnalytics>>;

/**
 * The two unmet-demand totals, read fresh on every page load.
 *
 * Deliberately outside the ten-minute cache the rest of this file sits behind.
 * Marking a line treated is a thing the shop does *on this page*, and a header
 * that still claims twelve outstanding references for ten minutes after the
 * shop cleared the twelfth reads as broken. It is one count and one sum over a
 * small table on the index SearchMiss already carries for exactly this
 * predicate, which is a price worth paying to stay truthful.
 */
export async function getUnmetTotals() {
  const [row] = await prisma.$queryRaw<{ lines: bigint; searches: bigint }[]>`
    SELECT COUNT(*)::bigint AS lines, COALESCE(SUM("count"), 0)::bigint AS searches
    FROM "SearchMiss"
    WHERE "resolvedAt" IS NULL
  `;
  return { lines: Number(row?.lines ?? 0), searches: Number(row?.searches ?? 0) };
}

/**
 * The cached entry point. See lib/cache for why ten minutes and why nothing
 * invalidates it.
 */
export const getDeepAnalytics = unstable_cache(readDeepAnalytics, ["deep-analytics"], {
  revalidate: ANALYTICS_TTL,
  tags: [ANALYTICS_TAG],
});

/** Uncached, for the suite that measures what one cold read costs. */
export const __readDeepAnalyticsUncached = readDeepAnalytics;
