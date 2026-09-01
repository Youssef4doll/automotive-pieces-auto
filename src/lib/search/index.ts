import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { looksLikeReference, normalizeReference } from "@/lib/reference";
import { fold, type ParsedQuery } from "./normalize";
import { CANONICAL_TERMS } from "./synonyms";

export { parseQuery, fold } from "./normalize";
export type { ParsedQuery } from "./normalize";

/**
 * How close a misspelling has to be before we offer the part anyway.
 *
 * word_similarity compares the query against the best-matching run of words
 * inside a long document, which is exactly the shape here — three typed words
 * against a blob holding a name, a brand, a family and a fistful of
 * references. 0.42 was chosen against the real catalogue: it catches
 * "plaquete", "frin" and "distrubution", and stops short of matching every
 * part that merely contains the letter runs.
 */
const FUZZY_THRESHOLD = 0.42;

/** Enough exact answers that guesses would only get in the way. */
const FUZZY_FLOOR = 6;

/** However thin the page, a wall of near-misses is not an improvement. */
const FUZZY_MAX = 8;

/** Below this a "did you mean" is a guess, not a correction. */
const SUGGESTION_THRESHOLD = 0.5;

export type SearchHit = { id: string; tier: number; score: number };

/**
 * Rebuild the searchable blob for some products, or for all of them.
 *
 * Done in SQL on purpose. Products are written from the admin form, from the
 * CSV import and from the seed, and a helper that each of those has to
 * remember to call is a helper that will eventually be forgotten — a part
 * that exists, sells, and cannot be found. One statement that joins the brand,
 * the category, its family and every reference can therefore be re-run over
 * the whole catalogue at any time to repair drift, and is cheap enough to do
 * exactly that after an import.
 */
export async function reindexProducts(ids?: string[]): Promise<number> {
  // Scalar subqueries rather than joins: brand and parent category are both
  // optional, and UPDATE … FROM cannot express a left join to its own target.
  // concat_ws drops the NULLs for us.
  const scope = ids?.length ? Prisma.sql`WHERE p.id IN (${Prisma.join(ids)})` : Prisma.empty;
  return prisma.$executeRaw`
    UPDATE "Product" p SET
      "searchText" = lower(unaccent(concat_ws(' ',
        p.name, p.sku, p.description,
        (SELECT b.name FROM "Brand" b WHERE b.id = p."brandId"),
        (SELECT c.name FROM "Category" c WHERE c.id = p."categoryId"),
        (SELECT pc.name FROM "Category" pc
           JOIN "Category" c2 ON c2."parentId" = pc.id
          WHERE c2.id = p."categoryId"),
        array_to_string(p."oemRefs", ' '),
        (SELECT string_agg(r.raw || ' ' || r.normalized, ' ')
           FROM "PartReference" r WHERE r."productId" = p.id)
      ))),
      -- Kept in the same statement as searchText so a part can never end up
      -- searchable by name but unreachable by its number, or the reverse.
      "skuNormalized" = regexp_replace(upper(unaccent(p.sku)), '[^A-Z0-9]', '', 'g'),
      "refsNormalized" = COALESCE((
        SELECT array_agg(DISTINCT regexp_replace(upper(unaccent(v)), '[^A-Z0-9]', '', 'g'))
        FROM (
          SELECT unnest(p."oemRefs") AS v
          UNION ALL
          SELECT r.raw FROM "PartReference" r WHERE r."productId" = p.id
        ) AS refs
        WHERE length(regexp_replace(upper(unaccent(v)), '[^A-Z0-9]', '', 'g')) >= 3
      ), '{}')
    ${scope}
  `;
}

/**
 * Rank product ids for a query.
 *
 * Three tiers, and the tier matters more than the score inside it:
 *
 *   0 — the query IS a reference this shop stocks. Somebody holding the broken
 *       part and typing the number off it wants that part, not a list of
 *       things like it.
 *   1 — every word of the query appears in the product's index blob. This is
 *       the ordinary "plaquettes clio" case and it must outrank any fuzzy
 *       result, however similar.
 *   2 — trigram match: the query is close enough to the blob to be a
 *       misspelling of it.
 *
 * Ties break on availability then top-seller then price: of two equally
 * relevant parts, the one that can ship today is the better answer.
 */
export async function rankProducts(parsed: ParsedQuery, take = 40): Promise<SearchHit[]> {
  if (!parsed.folded) return [];

  // Only when the query looks like a part number: "frein" is not a reference,
  // and treating it as one would put an arbitrary product at the top.
  const exactIds = looksLikeReference(parsed.raw) ? await referenceMatches(parsed.raw) : [];
  const hits: SearchHit[] = exactIds.map((id) => ({ id, tier: 0, score: 1 }));
  const seen = new Set(exactIds);

  // Each token must appear somewhere in the blob. LIKE on a trigram-indexed
  // column is index-assisted for patterns of three characters or more, which
  // is every token that survives normalisation.
  const tokenConditions = parsed.tokens
    .filter((t) => t.length >= 2)
    .map((t) => Prisma.sql`p."searchText" LIKE ${`%${t}%`}`);

  if (tokenConditions.length > 0) {
    const rows = await prisma.$queryRaw<{ id: string; score: number }[]>`
      SELECT p.id, word_similarity(${parsed.fuzzyText}, p."searchText")::float8 AS score
      FROM "Product" p
      WHERE p.active AND ${Prisma.join(tokenConditions, " AND ")}
      ORDER BY score DESC,
               (p."stockQty" > 0) DESC,
               p."isTopSeller" DESC,
               p."priceSell" ASC
      LIMIT ${take}
    `;
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      hits.push({ id: r.id, tier: 1, score: r.score });
    }
  }

  // Fuzzy is a rescue, not a garnish. Topping up a page that already answered
  // the question buries the answer: "filtre huile" found its oil filters and
  // then padded the page with fifteen parts that merely share letter runs.
  // So it only runs when the exact reading came back thin.
  if (hits.length >= FUZZY_FLOOR) return hits.slice(0, take);

  const room = Math.min(take - hits.length, FUZZY_MAX);
  const fuzzy = await prisma.$transaction(async (tx) => {
    // Session-scoped, so the operator below can use the GIN index instead of
    // scanning; a literal similarity() call in the WHERE clause cannot.
    await tx.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = ${FUZZY_THRESHOLD}`);
    return tx.$queryRaw<{ id: string; score: number }[]>`
      SELECT p.id, word_similarity(${parsed.fuzzyText}, p."searchText")::float8 AS score
      FROM "Product" p
      WHERE p.active
        AND ${parsed.fuzzyText} <% p."searchText"
        ${seen.size > 0 ? Prisma.sql`AND p.id NOT IN (${Prisma.join([...seen])})` : Prisma.empty}
      ORDER BY score DESC, (p."stockQty" > 0) DESC, p."isTopSeller" DESC
      LIMIT ${room}
    `;
  });
  for (const r of fuzzy) hits.push({ id: r.id, tier: 2, score: r.score });

  return hits.slice(0, take);
}

/**
 * Ids of products carrying this exact part number, in any spelling.
 *
 * Every comparison happens in the normalised space — separators stripped,
 * upper case — because that is the only space in which "GDB 1330", "gdb-1330"
 * and "GDB1330" are the same number. Comparing the raw strings is what made
 * /reference/ds1001 miss the part whose SKU is printed "DS-1001".
 */
export async function referenceMatches(raw: string): Promise<string[]> {
  const normalized = normalizeReference(raw);
  if (normalized.length < 3) return [];
  const hits = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { skuNormalized: normalized },
        { refsNormalized: { has: normalized } },
        { references: { some: { normalized } } },
      ],
    },
    select: { id: true },
    take: 12,
  });
  return hits.map((h) => h.id);
}

export type DidYouMean = { term: string; confidence: number } | null;

/**
 * The correction to offer above the results.
 *
 * Only ever a suggestion — the query is never silently rewritten, because a
 * customer who typed a reference and got shown something else has no way to
 * tell whether the shop understood them. Candidates come from the shop's own
 * category and brand names plus the trade vocabulary, so a correction always
 * points at wording that leads somewhere.
 */
export async function didYouMean(parsed: ParsedQuery): Promise<DidYouMean> {
  if (parsed.folded.length < 4 || looksLikeReference(parsed.raw)) return null;
  // The vocabulary already read the query as trade wording, so there is
  // nothing to correct — and the nearest dictionary entry is usually a
  // *vaguer* one ("filtre clim" → "filtre"), which reads as the search
  // misunderstanding a query it in fact got right.
  if (parsed.canonical.length > 0) return null;

  const [categories, brands] = await Promise.all([
    prisma.category.findMany({
      where: {
        OR: [
          { products: { some: { active: true } } },
          { children: { some: { products: { some: { active: true } } } } },
        ],
      },
      select: { name: true },
    }),
    prisma.brand.findMany({
      where: { products: { some: { active: true } } },
      select: { name: true },
    }),
  ]);

  const candidates = [
    ...categories.map((c) => c.name),
    ...brands.map((b) => b.name),
    ...CANONICAL_TERMS,
  ];

  let best: DidYouMean = null;
  for (const candidate of candidates) {
    const score = diceCoefficient(parsed.folded, fold(candidate));
    if (score > (best?.confidence ?? SUGGESTION_THRESHOLD)) best = { term: candidate, confidence: score };
  }

  // Offering back what was already typed is noise, not help.
  if (best && fold(best.term) === parsed.folded) return null;
  return best;
}

/** Trigram Dice coefficient — the same idea pg_trgm uses, in JS for short strings. */
function diceCoefficient(a: string, b: string): number {
  const grams = (s: string) => {
    const padded = `  ${s} `;
    const out = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let shared = 0;
  for (const g of ga) if (gb.has(g)) shared++;
  return (2 * shared) / (ga.size + gb.size);
}

/**
 * Record a search that found nothing.
 *
 * Grouped by the normalised form so the buying list counts wants, not
 * keystrokes. Never throws: a demand log is not worth failing a page render
 * over.
 */
export async function recordSearchMiss(parsed: ParsedQuery): Promise<void> {
  const key = parsed.tokens.join(" ") || parsed.folded;
  if (key.length < 3) return;
  try {
    await prisma.searchMiss.upsert({
      where: { normalized: key },
      create: { normalized: key, query: parsed.raw },
      update: { query: parsed.raw, count: { increment: 1 }, lastSeenAt: new Date(), resolvedAt: null },
    });
  } catch {
    /* demand intelligence is best-effort */
  }
}

/** The queries customers ran that the shop could not answer, most wanted first. */
export async function topSearchMisses(take = 25) {
  return prisma.searchMiss.findMany({
    where: { resolvedAt: null },
    orderBy: [{ count: "desc" }, { lastSeenAt: "desc" }],
    take,
  });
}
