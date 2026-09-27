import { prisma } from "@/lib/prisma";
import { Cache, guard, ok, preflight } from "../../_lib/respond";

const PUBLIC = { cache: Cache.catalogue, cors: true };

/** At least this many different people must have searched it. One is a person, not a trend. */
const MIN_SEARCHERS = 3;
const DAYS = 30;
const TAKE = 8;

/**
 * "Recherches populaires" — what people actually searched and found, over
 * the last thirty days, on the app and the website.
 *
 * Only queries that returned parts, only queries at least three different
 * sessions typed (so one customer's odd search — a phone number, a name —
 * never appears on everybody's screen), folded to lower case. Never a
 * seeded or invented list: a young shop with little traffic shows none, and
 * the app then shows no "popular" row at all. Counts are not returned.
 */
export async function GET() {
  return guard(
    async () => {
      const rows = await prisma.$queryRaw<{ q: string }[]>`
        SELECT q
        FROM (
          SELECT lower(trim(coalesce(properties->>'q', properties->>'query'))) AS q, "sessionId"
          FROM "AnalyticsEvent"
          WHERE "createdAt" > now() - (${DAYS}::int * interval '1 day')
            AND (
              (name = 'search_query' AND (properties->>'results')::int > 0 AND (properties->>'submitted')::boolean)
              OR (name = 'search_completed' AND (properties->>'resultCount')::int > 0)
            )
        ) s
        WHERE length(q) BETWEEN 3 AND 40 AND q !~ '[0-9]{6,}|@'
        GROUP BY q
        HAVING COUNT(DISTINCT "sessionId") >= ${MIN_SEARCHERS}
        ORDER BY COUNT(DISTINCT "sessionId") DESC, q ASC
        LIMIT ${TAKE}
      `;
      return ok(rows.map((r) => r.q), PUBLIC);
    },
    "search/popular",
    PUBLIC,
  );
}

export const OPTIONS = preflight;
