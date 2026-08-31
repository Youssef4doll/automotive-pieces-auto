import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hit, callerKey, LIMITS } from "@/lib/rate-limit";

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
 * Ordered by how decisive the match is: an exact reference first (somebody
 * typing a part number knows exactly what they want), then categories, then
 * brands, then product names.
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

/** Uppercase, strip accents and separators: "gdb 1330" and "GDB-1330" match. */
function normaliseRef(value: string) {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export async function GET(request: NextRequest) {
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
  const ref = normaliseRef(q);

  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      where: {
        active: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { oemRefs: { has: ref } },
        ],
      },
      select: {
        name: true,
        slug: true,
        sku: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
      },
      take: 8,
      orderBy: { isTopSeller: "desc" },
    }),
    prisma.category.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
        // Never suggest a page with nothing on it.
        OR: [{ products: { some: { active: true } } }, { children: { some: { products: { some: { active: true } } } } }],
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

  const suggestions: Suggestion[] = [];

  // A reference match is the strongest possible signal of intent.
  const exact = products.find((p) => normaliseRef(p.sku) === ref);
  if (exact) {
    suggestions.push({
      label: exact.sku,
      kind: "reference",
      href: `/produit/${exact.slug}`,
      hint: exact.name,
    });
  }

  for (const c of categories) {
    suggestions.push({
      label: c.name,
      kind: "category",
      href: c.parent ? `/catalogue/${c.parent.slug}/${c.slug}` : `/catalogue/${c.slug}`,
      hint: c.parent?.name,
    });
  }

  for (const b of brands) {
    suggestions.push({
      label: b.name,
      kind: "brand",
      // Brands are a search facet rather than a page of their own.
      href: `/recherche?q=${encodeURIComponent(b.name)}`,
      hint: `${b._count.products} référence(s)`,
    });
  }

  for (const p of products) {
    if (exact && p.slug === exact.slug) continue;
    suggestions.push({
      label: p.name,
      kind: "product",
      href: `/produit/${p.slug}`,
      hint: p.brand?.name ?? p.category.name,
    });
  }

  return NextResponse.json({ suggestions: suggestions.slice(0, 10) });
}
