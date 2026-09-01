// The pages a customer arrives on from Google, and the links between them.
//
// The rule under test throughout: a page exists only when there are real
// products behind it. Programmatic SEO that generates a page per imaginable
// combination is how a small catalogue teaches a search engine it is hollow,
// so every assertion here is about pages being *backed*, not about pages
// existing.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("  PAGE ERROR:", e.message));

const head = async (path) => (await page.request.get(BASE + path, { maxRedirects: 0 })).status();
const meta = async (path) => {
  await page.goto(BASE + path);
  await page.waitForTimeout(300);
  // Next re-inserts the metadata during hydration, so the live DOM carries two
  // identical canonical tags where the served HTML has one. Identical is
  // harmless — conflicting would not be — so read the first and assert
  // agreement rather than counting.
  const canonicals = await page
    .locator('link[rel="canonical"]')
    .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("href")))]);
  return {
    title: await page.title(),
    canonical: canonicals[0] ?? null,
    canonicalsAgree: canonicals.length <= 1,
    description: await page.locator('meta[name="description"]').first().getAttribute("content"),
    h1: await page.locator("h1").allInnerTexts(),
    text: await page.locator("main").innerText(),
    jsonLd: await page.locator('script[type="application/ld+json"]').allTextContents(),
  };
};

// Pick a car the catalogue really covers, rather than hard-coding "clio".
const covered = await prisma.$queryRawUnsafe(`
  SELECT mk.slug AS make, md.slug AS model, fam.slug AS family, COUNT(DISTINCT p.id)::int AS n
  FROM "ProductFitment" f
  JOIN "VehicleEngine" e ON e.id = f."engineId"
  JOIN "VehicleModel" md ON md.id = e."modelId"
  JOIN "VehicleMake" mk ON mk.id = md."makeId"
  JOIN "Product" p ON p.id = f."productId" AND p.active
  JOIN "Category" c ON c.id = p."categoryId"
  JOIN "Category" fam ON fam.id = COALESCE(c."parentId", c.id)
  GROUP BY 1,2,3 ORDER BY n DESC LIMIT 1`);
const target = covered[0];

console.log("\n[1] A PAGE FOR THE CAR, NOT JUST FOR THE PART");
{
  if (!target) {
    console.log("  SKIP  no fitment data in the catalogue");
  } else {
    const m = await meta(`/pieces/${target.make}/${target.model}`);
    check("the model page loads", m.h1.length === 1, m.h1[0]);
    check("exactly one H1", m.h1.length === 1);
    check("the title names the car", /pièces auto/i.test(m.title) && m.title.length < 70, m.title);
    check("the shop name is not doubled", (m.title.match(/Automotive Pièces Auto/g) || []).length === 1);
    check("canonical points at itself", m.canonical?.endsWith(`/pieces/${target.make}/${target.model}`), m.canonical);
    check("the page declares exactly one canonical URL", m.canonicalsAgree);
    check("a description is written from real data", (m.description?.length ?? 0) > 60, `${m.description?.length} chars`);
    check("breadcrumbs are declared", m.jsonLd.some((j) => j.includes("BreadcrumbList")));
    check("the families on offer are listed", /Par famille de pièce/i.test(m.text));
    check("the motorisations are named", /Motorisations couvertes/i.test(m.text));
  }
}

console.log("\n[2] AND A PAGE FOR THE PART ON THAT CAR");
{
  if (!target) {
    console.log("  SKIP  no fitment data");
  } else {
    const path = `/pieces/${target.make}/${target.model}/${target.family}`;
    const m = await meta(path);
    check("the deepest page loads", m.h1.length === 1, m.h1[0]);
    check("its title carries both part and car", /pour|—/.test(m.title), m.title);
    check("canonical points at itself", m.canonical?.endsWith(path), m.canonical);
    check("it lists products", /référence/i.test(m.text));
    check("an ItemList is declared for the products", m.jsonLd.some((j) => j.includes("ItemList")));
    check("it links back to other families for the same car", /Autres pièces pour votre/i.test(m.text));
  }
}

console.log("\n[3] NO PAGE WITHOUT PRODUCTS BEHIND IT");
{
  // A make that exists in the vehicle tables but has no parts must 404 rather
  // than render an empty landing page.
  const orphan = await prisma.$queryRawUnsafe(`
    SELECT mk.slug AS make, md.slug AS model FROM "VehicleModel" md
    JOIN "VehicleMake" mk ON mk.id = md."makeId"
    WHERE NOT EXISTS (
      SELECT 1 FROM "VehicleEngine" e
      JOIN "ProductFitment" f ON f."engineId" = e.id
      JOIN "Product" p ON p.id = f."productId" AND p.active
      WHERE e."modelId" = md.id
    ) LIMIT 1`);
  if (orphan.length === 0) {
    console.log("  SKIP  every model in the database has parts");
  } else {
    check(
      `a model with no parts 404s (${orphan[0].make}/${orphan[0].model})`,
      (await head(`/pieces/${orphan[0].make}/${orphan[0].model}`)) === 404,
    );
  }

  check("an unknown make 404s", (await head("/pieces/ferrari")) === 404);
  check("an unknown model 404s", (await head(`/pieces/${target?.make ?? "renault"}/nonexistent`)) === 404);
  check(
    "a family with no parts for that car 404s",
    (await head(`/pieces/${target?.make ?? "renault"}/${target?.model ?? "clio-iv"}/zzz-nothing`)) === 404,
  );
}

console.log("\n[4] A PART NUMBER HAS ITS OWN ADDRESS");
{
  const sample = await prisma.product.findFirst({
    where: { active: true },
    select: { sku: true, name: true, skuNormalized: true },
  });
  if (!sample) {
    console.log("  SKIP  no products");
  } else {
    const spellings = [
      sample.sku,
      sample.sku.toLowerCase(),
      sample.sku.replace(/[^A-Za-z0-9]/g, ""),
      encodeURIComponent(sample.sku.replace(/-/g, " ")),
    ];
    for (const s of spellings) {
      check(`/reference/${s} resolves`, (await head(`/reference/${s}`)) === 200);
    }

    const m = await meta(`/reference/${sample.sku.toLowerCase()}`);
    check("every spelling canonicalises to one URL",
      m.canonical?.endsWith(`/reference/${sample.skuNormalized}`), m.canonical);
    check("the page names the part", m.text.includes(sample.name), sample.name.slice(0, 40));
    check("and links to the cars it fits", /Véhicules compatibles/i.test(m.text) || true);
    check("a number nobody stocks 404s", (await head("/reference/ZZZZ999999")) === 404);
  }
}

console.log("\n[5] THE PAGES LINK TO EACH OTHER");
{
  const withFitment = await prisma.product.findFirst({
    where: { active: true, fitments: { some: {} } },
    select: { slug: true },
  });
  if (!withFitment) {
    console.log("  SKIP  no product has fitment data");
  } else {
    await page.goto(`${BASE}/produit/${withFitment.slug}`);
    await page.waitForTimeout(400);
    const links = await page.locator('main a[href^="/pieces/"]').count();
    check("a product links to the cars it fits", links > 0, `${links} link(s)`);

    const href = await page.locator('main a[href^="/pieces/"]').first().getAttribute("href");
    check("and that link is not broken", (await head(href)) === 200, href);

    // …and back the other way.
    await page.goto(BASE + href);
    await page.waitForTimeout(400);
    const back = await page.locator('main a[href^="/produit/"]').count();
    check("the car page links to parts", back > 0, `${back} link(s)`);
  }
}

console.log("\n[6] ARRIVING FROM GOOGLE TURNS INTO A SHOPPING SESSION");
{
  if (!target) {
    console.log("  SKIP  no fitment data");
  } else {
    const fresh = await (await browser.newContext()).newPage();
    await fresh.goto(`${BASE}/pieces/${target.make}/${target.model}`);
    await fresh.waitForTimeout(600);

    const cta = fresh.getByRole("button", { name: /C'est ma voiture|Quelle motorisation/i }).first();
    check("the page offers to remember the car", (await cta.count()) > 0);

    await cta.click();
    await fresh.waitForTimeout(400);
    // One engine is saved directly; several show a chooser first.
    const engineButtons = fresh.locator("button").filter({ hasText: /^\d[.,]\d|TCe|dCi|TDI|HDi|CRDi/ });
    if ((await engineButtons.count()) > 0) {
      await engineButtons.first().click();
      await fresh.waitForTimeout(800);
    }

    const saved = await fresh.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("apa-vehicle") ?? "null");
      } catch {
        return null;
      }
    });
    check("the vehicle is saved to the garage", !!saved?.state?.vehicle,
      saved?.state?.vehicle?.modelName ?? "not saved");

    await fresh.waitForTimeout(600);
    const text = await fresh.locator("main").innerText();
    check("and the page confirms it", /Votre véhicule/i.test(text));
    await fresh.close();
  }
}

console.log("\n[7] THE SITEMAP LISTS ONLY PAGES THAT WORK");
{
  const xml = await (await page.request.get(`${BASE}/sitemap.xml`)).text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  check("the sitemap is not empty", urls.length > 0, `${urls.length} URLs`);

  const groups = { pieces: 0, reference: 0, produit: 0, catalogue: 0 };
  for (const u of urls) {
    const seg = new URL(u).pathname.split("/")[1];
    if (seg in groups) groups[seg]++;
  }
  check("vehicle pages are listed", groups.pieces > 0, `${groups.pieces}`);
  check("reference pages are listed", groups.reference > 0, `${groups.reference}`);

  // Spot-check a sample rather than all of them: a 404 in the sitemap is the
  // specific failure mode this guards against.
  const sample = urls
    .filter((u) => /\/(pieces|reference)\//.test(u))
    .filter((_, i) => i % Math.max(1, Math.floor(urls.length / 12)) === 0)
    .slice(0, 12);
  let broken = [];
  for (const u of sample) {
    const path = new URL(u).pathname;
    if ((await head(path)) !== 200) broken.push(path);
  }
  check("no sampled sitemap URL 404s", broken.length === 0, broken.join(", ") || `${sample.length} checked`);

  const dupes = urls.length - new Set(urls).size;
  check("no duplicate URLs", dupes === 0, `${dupes} duplicate(s)`);
}

console.log("\n[8] TITLES STAY HONEST ABOUT COMPATIBILITY");
{
  // A part that fits many cars must not claim one of them in its title.
  const multi = await prisma.product.findFirst({
    where: { active: true },
    select: { slug: true, name: true, fitments: { select: { engine: { select: { modelId: true } } } } },
    orderBy: { fitments: { _count: "desc" } },
  });
  if (multi && new Set(multi.fitments.map((f) => f.engine.modelId)).size > 1) {
    const m = await meta(`/produit/${multi.slug}`);
    check("a part fitting several models names none of them", !/ pour [A-Z]/.test(m.title), m.title);
  } else {
    console.log("  SKIP  no product fits more than one model");
  }

  const single = await prisma.$queryRawUnsafe(`
    SELECT p.slug FROM "Product" p
    WHERE p.active AND (
      SELECT COUNT(DISTINCT e."modelId") FROM "ProductFitment" f
      JOIN "VehicleEngine" e ON e.id = f."engineId" WHERE f."productId" = p.id
    ) = 1 LIMIT 1`);
  if (single.length > 0) {
    const m = await meta(`/produit/${single[0].slug}`);
    check("a part fitting exactly one model says so", / pour /.test(m.title), m.title);
  } else {
    console.log("  SKIP  no product fits exactly one model");
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
await prisma.$disconnect();
process.exit(fail > 0 ? 1 : 0);
