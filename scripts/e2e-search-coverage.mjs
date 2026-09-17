/**
 * Search coverage: can a shopper find the things this shop sells?
 *
 * Written after an audit found that exact product names returned "0 résultat"
 * — "Huile moteur CASTROL EDGE 5W30", "Bougie d'allumage NGK BKR6E" — for
 * parts that were in stock on the home page. Every one of those symptoms had
 * the same cause: `searchText` was built by application code that only the CSV
 * import called, so a product created in the admin had no index at all and a
 * renamed one kept its old name. It is a database trigger now.
 *
 * Three layers, because they fail differently:
 *
 *   [1] the index agrees with its own definition, for every row. Pure SQL, so
 *       it stays fast at 50 000 parts and catches drift the moment it starts.
 *   [2] the four write paths keep it that way — this is the regression itself.
 *   [3] the HTTP search page actually returns the part, for a sample of real
 *       products, brands and families. The index can be perfect and the page
 *       still wrong.
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

/** The slugs the results page actually offers. */
async function found(q) {
  const res = await fetch(`${BASE}/recherche?q=${encodeURIComponent(q)}`);
  const html = await res.text();
  return new Set([...html.matchAll(/\/produit\/([a-z0-9-]+)/g)].map((m) => m[1]));
}

/* ------------------------------------------------------------------ */
console.log("\n[1] THE INDEX AGREES WITH ITS OWN DEFINITION, FOR EVERY ROW");
{
  // The same function the trigger calls, asked about every stored row. A
  // mismatch means something wrote a product without the trigger running,
  // which is the exact failure this suite exists for.
  const [drift] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS n
    FROM "Product" p, LATERAL product_search_fields(
      p.id, p.name, p.sku, p.description, p."brandId", p."categoryId", p."oemRefs") f
    WHERE p."searchText"     IS DISTINCT FROM f.search_text
       OR p."skuNormalized"  IS DISTINCT FROM f.sku_normalized
       OR COALESCE(p."refsNormalized", '{}') IS DISTINCT FROM COALESCE(f.refs_normalized, '{}')
  `);
  const total = await prisma.product.count();
  check("no product's stored index differs from the definition", drift.n === 0, `${drift.n} of ${total} adrift`);

  const [blank] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM "Product" WHERE active AND COALESCE("searchText", '') = ''`,
  );
  check("no active product has an empty index", blank.n === 0, `${blank.n} blank`);

  // Someone dropping the trigger would make [2] pass on a warm database and
  // fail silently on the next admin edit, so the trigger itself is checked.
  const triggers = await prisma.$queryRawUnsafe(`
    SELECT tgname FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname IN ('product_reindex','part_reference_reindex','brand_reindex','category_reindex')
  `);
  const names = triggers.map((t) => t.tgname).sort();
  check("all four reindex triggers are installed", names.length === 4, names.join(", ") || "none");
}

/* ------------------------------------------------------------------ */
console.log("\n[2] EVERY WRITE PATH LEAVES THE PART FINDABLE");
{
  const family = await prisma.category.findFirst({ where: { parentId: { not: null } }, select: { id: true } });
  const slug = `zz-search-coverage-${Date.now()}`;
  const blob = async (id) =>
    (await prisma.product.findUnique({ where: { id }, select: { searchText: true } }))?.searchText ?? "";

  const made = await prisma.product.create({
    data: { name: "ZZPROBE Plaquette Coverage", slug, sku: "ZZ-COV-1", priceSell: 10, categoryId: family.id, stockQty: 0 },
  });
  try {
    // Creating a product is what the admin form does, and it is what used to
    // produce a part that existed, sold, and could not be found.
    check("a newly created product is indexed", (await blob(made.id)).includes("zzprobe"));
    check("and its SKU is matchable in the stripped space",
      (await prisma.product.findUnique({ where: { id: made.id }, select: { skuNormalized: true } })).skuNormalized === "ZZCOV1");

    await prisma.product.update({ where: { id: made.id }, data: { name: "ZZRENAMED Plaquette Coverage" } });
    const renamed = await blob(made.id);
    check("a rename reaches the index", renamed.includes("zzrenamed"));
    check("and the old name stops matching", !renamed.includes("zzprobe"), "or it stays findable under a name it no longer has");

    await prisma.partReference.create({ data: { productId: made.id, raw: "ZZ-REF-4821", normalized: "ZZREF4821", type: "OEM" } });
    let row = await prisma.product.findUnique({ where: { id: made.id }, select: { refsNormalized: true } });
    check("adding a part number makes it searchable", row.refsNormalized.includes("ZZREF4821"));

    await prisma.partReference.deleteMany({ where: { productId: made.id } });
    row = await prisma.product.findUnique({ where: { id: made.id }, select: { refsNormalized: true } });
    check("removing it stops it matching", !row.refsNormalized.includes("ZZREF4821"));

    // A brand correction has to reach the parts filed under it, or the brand
    // becomes unsearchable the day somebody fixes its spelling.
    const brand = await prisma.brand.findFirst({ where: { products: { some: {} } }, select: { id: true, name: true } });
    await prisma.brand.update({ where: { id: brand.id }, data: { name: "ZZBRANDPROBE" } });
    const child = await prisma.product.findFirst({ where: { brandId: brand.id }, select: { searchText: true } });
    check("renaming a brand reindexes its parts", (child?.searchText ?? "").includes("zzbrandprobe"));
    await prisma.brand.update({ where: { id: brand.id }, data: { name: brand.name } });
  } finally {
    await prisma.partReference.deleteMany({ where: { productId: made.id } });
    await prisma.product.delete({ where: { id: made.id } });
  }
}

/* ------------------------------------------------------------------ */
console.log("\n[3] THE SEARCH PAGE RETURNS THE PART");
{
  // A sample rather than the whole catalogue: this is one HTTP round trip per
  // query and the rule for every row is already enforced by [1]. Ordered, so
  // the sample is the same on every run and a failure is reproducible.
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { sku: "asc" },
    take: 25,
    select: { name: true, sku: true, slug: true, references: { select: { raw: true }, take: 1 } },
  });

  const missing = { name: [], sku: [], ref: [] };
  for (const p of products) {
    if (!(await found(p.name)).has(p.slug)) missing.name.push(p.name);
    if (!(await found(p.sku)).has(p.slug)) missing.sku.push(`${p.sku} (${p.name})`);
    for (const r of p.references) {
      if (!(await found(r.raw)).has(p.slug)) missing.ref.push(`${r.raw} (${p.name})`);
    }
  }
  check("every sampled product is found by its own name", missing.name.length === 0,
    missing.name.slice(0, 3).join(", ") || `${products.length} checked`);
  check("and by its SKU", missing.sku.length === 0, missing.sku.slice(0, 3).join(", ") || `${products.length} checked`);
  check("and by a part number printed on it", missing.ref.length === 0, missing.ref.slice(0, 3).join(", "));

  // A brand or a family name is what somebody types when they know the maker
  // but not the part. Returning nothing reads as "this shop has no Bosch".
  const brands = await prisma.brand.findMany({
    where: { products: { some: { active: true } } },
    select: { name: true, _count: { select: { products: true } } },
  });
  const emptyBrands = [];
  for (const b of brands) if ((await found(b.name)).size === 0) emptyBrands.push(`${b.name} (${b._count.products})`);
  check("every brand that stocks parts returns some", emptyBrands.length === 0,
    emptyBrands.slice(0, 4).join(", ") || `${brands.length} brands`);

  const families = await prisma.category.findMany({
    where: { products: { some: { active: true } } },
    select: { name: true, _count: { select: { products: true } } },
  });
  const emptyFamilies = [];
  for (const f of families) if ((await found(f.name)).size === 0) emptyFamilies.push(`${f.name} (${f._count.products})`);
  check("every family that holds parts returns some", emptyFamilies.length === 0,
    emptyFamilies.slice(0, 4).join(", ") || `${families.length} families`);
}

console.log(`\n${pass} passed, ${fail} failed`);
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
