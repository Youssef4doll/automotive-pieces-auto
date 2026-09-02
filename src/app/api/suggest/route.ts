import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hit, callerKey, LIMITS } from "@/lib/rate-limit";
import { parseQuery, rankProducts, fold } from "@/lib/search";
import { normalizeReference } from "@/lib/reference";

/**
 * Search suggestions, drawn only from what the shop actually sells.
 *
 * Every row returned corresponds to a real product, category, brand or part
 * reference in the database — there is no hand-written keyword list, and
 * nothing is suggested that would lead to an empty result page. That matters
 * more here than on a general store: suggesting "plaquettes Peugeot 208" for a
 * shop that has none teaches the customer the search is unreliable, which is
 * the one thing a parts search cannot afford.
 *
 * It runs the same ranking as the results page rather than its own cheaper
 * query, so the list under the box is a preview of what pressing Enter does.
 * A suggestion that leads somewhere different from the search it came from is
 * worse than no suggestion.
 *
 * Ordered by how decisive the match is: an exact reference first (somebody
 * typing a part number knows exactly what they want), then categories, then
 * brands, then products.
 */

const querySchema = z.string().trim().min(2).max(64);

export type Suggestion = {
  label: string;
  /** What the customer is looking at, so the UI can label and route it. */
  kind: "reference" | "category" | "brand" | "product";
  href: string;
  /** Extra context shown in grey — the family a subcategory belongs to, etc. */
  hint?: string;
};

/**
 * The suggestions depend on the query and the catalogue, never on who is
 * asking — no session, no cart, nothing personal — so they are safe to cache
 * shared. A minute of staleness costs at most a minute before a newly
 * published part turns up in the type-ahead, and it takes the repeat traffic
 * of a whole shop's worth of people typing "filtre" off the database.
 */
const CACHE_HEADER = "public, max-age=30, s-maxage=60, stale-while-revalidate=300";

export async function GET(request: NextRequest) {
  try {
    return await suggest(request);
  } catch (err) {
    // A type-ahead must never be the thing that breaks the page. If the
    // database is unreachable, the box stays a plain search box; the customer
    // presses Enter and gets the results page's own error handling.
    console.error("suggest failed", err);
    return NextResponse.json({ suggestions: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}

async function suggest(request: NextRequest) {
  const gate = hit(await callerKey("suggest"), LIMITS.suggest.limit, LIMITS.suggest.windowMs);
  if (!gate.ok) {
    return NextResponse.json(
      { suggestions: [] },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  const parsed = querySchema.safeParse(request.nextUrl.searchParams.get("q") ?? "");
  if (!parsed.success) return NextResponse.json({ suggestions: [] });

  const q = parsed.data;
  const query = parseQuery(q);
  const ref = normalizeReference(q);

  // Categories and brands are matched on the expanded query too, so "kit
  // distri" offers the Distribution family and not just the parts in it.
  const haystacks = [query.folded, ...query.canonical, ...query.tokens];

  const [hits, categories, brands] = await Promise.all([
    rankProducts(query, 6),
    prisma.category.findMany({
      where: {
        OR: haystacks.map((h) => ({ name: { contains: h, mode: "insensitive" as const } })),
        AND: {
          // Never suggest a page with nothing on it.
          OR: [
            { products: { some: { active: true } } },
            { children: { some: { products: { some: { active: true } } } } },
          ],
        },
      },
      select: { name: true, slug: true, parent: { select: { slug: true, name: true } } },
      take: 4,
    }),
    prisma.brand.findMany({
      where: { name: { contains: q, mode: "insensitive" }, products: { some: { active: true } } },
      select: { name: true, _count: { select: { products: true } } },
      take: 3,
    }),
  ]);

  const products = hits.length
    ? await prisma.product.findMany({
        where: { id: { in: hits.map((h) => h.id) } },
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          brand: { select: { name: true } },
          category: { select: { name: true } },
        },
      })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const ranked = hits.map((h) => byId.get(h.id)).filter((p): p is (typeof products)[number] => !!p);

  const suggestions: Suggestion[] = [];

  // A reference match is the strongest possible signal of intent.
  const exact = ranked.find((p) => normalizeReference(p.sku) === ref);
  if (exact) {
    suggestions.push({ label: exact.sku, kind: "reference", href: `/produit/${exact.slug}`, hint: exact.name });
  }

  // Categories before products: "freinage" should offer the family page, which
  // is a better answer than any single pad, and it is one tap from there to
  // the parts.
  const seenCategories = new Set<string>();
  for (const c of categories) {
    if (seenCategories.has(c.slug)) continue;
    seenCategories.add(c.slug);
    suggestions.push({
      label: c.name,
      kind: "category",
      href: c.parent ? `/catalogue/${c.parent.slug}/${c.slug}` : `/catalogue/${c.slug}`,
      hint: c.parent?.name,
    });
  }

  for (const b of brands) {
    // Only offer a brand when the customer is plausibly typing its name, not
    // because a synonym happened to touch it.
    if (!fold(b.name).startsWith(fold(q).slice(0, 3))) continue;
    suggestions.push({
      label: b.name,
      kind: "brand",
      // Brands are a search facet rather than a page of their own.
      href: `/recherche?q=${encodeURIComponent(b.name)}`,
      hint: `${b._count.products} référence(s)`,
    });
  }

  for (const p of ranked) {
    if (exact && p.slug === exact.slug) continue;
    suggestions.push({
      label: p.name,
      kind: "product",
      href: `/produit/${p.slug}`,
      hint: p.brand?.name ?? p.category.name,
    });
  }

  return NextResponse.json(
    { suggestions: suggestions.slice(0, 10) },
    { headers: { "Cache-Control": CACHE_HEADER } },
  );
}
