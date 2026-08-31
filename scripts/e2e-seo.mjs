/**
 * SEO, metadata and page-hygiene suite.
 *
 * Measured in a real browser against the built site rather than read off the
 * source, because what matters is the markup that actually reaches a crawler.
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
function check(label, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();

const consoleIssues = [];
p.on("console", (m) => {
  if (m.type() === "error") consoleIssues.push({ url: p.url(), text: m.text().slice(0, 200) });
});
p.on("pageerror", (e) => consoleIssues.push({ url: p.url(), text: `pageerror: ${String(e).slice(0, 200)}` }));

// A real product and a real stocked category to test against.
const product = await prisma.product.findFirst({ where: { active: true }, select: { slug: true, name: true, sku: true } });
const family = await prisma.category.findFirst({
  where: { parentId: null, OR: [{ products: { some: {} } }, { children: { some: { products: { some: {} } } } }] },
  select: { slug: true, children: { where: { products: { some: {} } }, select: { slug: true }, take: 1 } },
});

const PUBLIC_ROUTES = [
  "/",
  "/sources",
  `/catalogue/${family?.slug ?? "freinage"}`,
  ...(family?.children[0] ? [`/catalogue/${family.slug}/${family.children[0].slug}`] : []),
  `/produit/${product?.slug ?? "x"}`,
];

async function meta(url) {
  await p.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(350);
  return p.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content ?? "",
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? "",
    robots: document.querySelector('meta[name="robots"]')?.content ?? "",
    ogTitle: document.querySelector('meta[property="og:title"]')?.content ?? "",
    ogImage: document.querySelector('meta[property="og:image"]')?.content ?? "",
    ogUrl: document.querySelector('meta[property="og:url"]')?.content ?? "",
    twitterCard: document.querySelector('meta[name="twitter:card"]')?.content ?? "",
    h1s: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()),
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
    imgsMissingAlt: [...document.querySelectorAll("img")].filter((i) => i.getAttribute("alt") === null).length,
    lang: document.documentElement.lang,
  }));
}

console.log("\n[1] EVERY PUBLIC PAGE HAS ITS OWN TITLE AND DESCRIPTION");
const seenTitles = new Map();
const seenDescriptions = new Map();
for (const route of PUBLIC_ROUTES) {
  const m = await meta(route);
  check(`${route} has a title`, m.title.length > 10 && m.title.length <= 90, `${m.title.length} chars`);
  check(`${route} has a description`, m.description.length >= 50 && m.description.length <= 200,
        `${m.description.length} chars`);
  seenTitles.set(route, m.title);
  seenDescriptions.set(route, m.description);
}
const titles = [...seenTitles.values()];
check("no two pages share a title", new Set(titles).size === titles.length,
      `${new Set(titles).size} distinct of ${titles.length}`);
const descs = [...seenDescriptions.values()];
check("no two pages share a description", new Set(descs).size === descs.length,
      `${new Set(descs).size} distinct of ${descs.length}`);

console.log("\n[2] EXACTLY ONE H1 PER PAGE");
for (const route of PUBLIC_ROUTES) {
  const m = await meta(route);
  check(`${route} has one h1`, m.h1s.length === 1, m.h1s.length === 1 ? m.h1s[0].slice(0, 40) : `found ${m.h1s.length}`);
}

console.log("\n[3] CANONICALS POINT AT THE PAGE'S OWN URL");
for (const route of PUBLIC_ROUTES) {
  const m = await meta(route);
  check(`${route} declares a canonical`, m.canonical.endsWith(route === "/" ? "/" : route),
        m.canonical || "(none)");
}
{
  // Filters must not create a second indexable URL for the same parts.
  const filtered = `/catalogue/${family?.slug}?tri=prix-asc`;
  const m = await meta(filtered);
  check("a filtered catalogue URL canonicalises to the bare category",
        m.canonical.endsWith(`/catalogue/${family?.slug}`), m.canonical || "(none)");
}

console.log("\n[4] PRIVATE PAGES ARE NOT INDEXABLE");
for (const route of ["/panier", "/commande", "/recherche", "/compte"]) {
  const m = await meta(route);
  check(`${route} is noindex`, /noindex/.test(m.robots), m.robots || "(none)");
}
{
  const robots = await (await p.request.get(`${BASE}/robots.txt`)).text();
  for (const path of ["/admin", "/compte", "/panier", "/commande"]) {
    check(`robots.txt disallows ${path}`, robots.includes(`Disallow: ${path}`));
  }
  check("robots.txt points at the sitemap", /Sitemap:\s*http/.test(robots));
}

console.log("\n[5] SHARE CARDS");
for (const route of PUBLIC_ROUTES) {
  const m = await meta(route);
  check(`${route} has an Open Graph title and image`, Boolean(m.ogTitle) && Boolean(m.ogImage));
  check(`${route} declares a Twitter card`, m.twitterCard === "summary_large_image");
}
{
  const res = await p.request.get(`${BASE}/opengraph-image`);
  check("the share image renders", res.status() === 200 && (res.headers()["content-type"] ?? "").includes("image"),
        res.headers()["content-type"]);
}

console.log("\n[6] STRUCTURED DATA IS VALID JSON AND HONEST");
{
  const home = await meta("/");
  const blocks = home.jsonLd.map((b) => JSON.parse(b));
  const types = blocks.map((b) => b["@type"]);
  check("the homepage declares an Organization", types.includes("Organization"));
  check("the homepage declares a WebSite", types.includes("WebSite"));
  check("the homepage declares the shop as a local business", types.includes("AutoPartsStore"));

  const store = blocks.find((b) => b["@type"] === "AutoPartsStore");
  const settings = await prisma.setting.findMany();
  const addressSetting = settings.find((s) => s.key === "shop_address")?.value ?? "";
  const addressIsReal = addressSetting && !addressSetting.includes("compléter");
  check("it claims an address only when one is configured",
        addressIsReal ? Boolean(store.address) : !store.address,
        addressIsReal ? "configured" : "not configured — omitted");
  check("no placeholder text leaked into structured data",
        !JSON.stringify(blocks).includes("compléter"));
}
{
  const prod = await meta(`/produit/${product.slug}`);
  const blocks = prod.jsonLd.map((b) => JSON.parse(b));
  const schema = blocks.find((b) => b["@type"] === "Product");
  check("the product page declares a Product", Boolean(schema));
  check("with the real reference", schema.sku === product.sku, schema.sku);
  check("with a price and currency", Boolean(schema.offers?.price) && schema.offers.priceCurrency === "TND");
  const reviewCount = await prisma.review.count({ where: { product: { slug: product.slug } } });
  check("a rating is claimed only when reviews exist",
        reviewCount > 0 ? Boolean(schema.aggregateRating) : !schema.aggregateRating,
        `${reviewCount} review(s)`);
  check("the product page declares a BreadcrumbList", blocks.some((b) => b["@type"] === "BreadcrumbList"));
}
{
  const cat = await meta(`/catalogue/${family.slug}`);
  const blocks = cat.jsonLd.map((b) => JSON.parse(b));
  check("the catalogue page declares a BreadcrumbList", blocks.some((b) => b["@type"] === "BreadcrumbList"));
}

console.log("\n[7] BREADCRUMBS ARE VISIBLE AND NAVIGABLE");
{
  await p.goto(`${BASE}/produit/${product.slug}`);
  await p.waitForTimeout(400);
  const nav = p.locator('nav[aria-label="Fil d\'Ariane"]');
  check("the product page shows a breadcrumb trail", (await nav.count()) === 1);
  check("its last item is the current page, not a link",
        (await nav.locator('[aria-current="page"]').count()) === 1);
  const first = nav.locator("a").first();
  check("its first link goes home", (await first.getAttribute("href")) === "/");
}

console.log("\n[8] THE 404 PAGE HELPS RATHER THAN APOLOGISES");
{
  const res = await p.request.get(`${BASE}/cette-page-nexiste-pas`, { maxRedirects: 0 });
  check("an unknown URL answers 404", res.status() === 404, `status=${res.status()}`);
  await p.goto(`${BASE}/cette-page-nexiste-pas`);
  await p.waitForTimeout(500);
  const body = await p.locator("body").innerText();
  check("it is in French and names the problem", /n'existe pas|introuvable/i.test(body));
  check("it offers a search box", (await p.locator('input[type="search"]').count()) > 0);
  check("it links into the catalogue", (await p.locator('a[href^="/catalogue/"]').count()) > 0);
  const m = await p.evaluate(() => ({
    robots: document.querySelector('meta[name="robots"]')?.content ?? "",
    h1s: document.querySelectorAll("h1").length,
  }));
  check("it is noindex but still followed", /noindex/.test(m.robots) && !/nofollow/.test(m.robots), m.robots);
  check("it has exactly one h1", m.h1s === 1, String(m.h1s));
}

console.log("\n[9] llms.txt DESCRIBES THE SITE TRUTHFULLY");
{
  const res = await p.request.get(`${BASE}/llms.txt`);
  check("llms.txt is served as plain text", res.status() === 200 &&
        (res.headers()["content-type"] ?? "").startsWith("text/plain"), res.headers()["content-type"]);
  const text = await res.text();
  const activeCount = await prisma.product.count({ where: { active: true } });
  check("it states the real catalogue size", text.includes(`${activeCount} référence(s)`), `${activeCount}`);
  check("it warns against inferring compatibility", /Ne déduisez jamais une compatibilité/.test(text));
  check("it names the private areas", text.includes("/admin") && text.includes("/compte"));
  check("no placeholder contact details leaked", !text.includes("compléter"));
}

console.log("\n[10] THE SOURCES PAGE REPORTS REAL NUMBERS");
{
  await p.goto(`${BASE}/sources`);
  await p.waitForTimeout(500);
  const body = await p.locator("main").innerText();
  const activeCount = await prisma.product.count({ where: { active: true } });
  const withFitment = await prisma.product.count({ where: { active: true, fitments: { some: {} } } });
  check("it shows the live catalogue count", body.includes(String(activeCount)), String(activeCount));
  check("it shows how many parts have verified fitment", body.includes(String(withFitment)), String(withFitment));
  check("it states what is not guaranteed", /Ce que nous ne garantissons pas/i.test(body));
  check("it is linked from the footer",
        (await p.locator('footer a[href="/sources"]').count()) > 0);
}

console.log("\n[11] THE SITEMAP LISTS ONLY REAL, INDEXABLE PAGES");
{
  const xml = await (await p.request.get(`${BASE}/sitemap.xml`)).text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  check("the sitemap has entries", urls.length > 0, `${urls.length} URLs`);
  check("it includes the sources page", urls.some((u) => u.endsWith("/sources")));
  check("it excludes private areas",
        !urls.some((u) => /\/(compte|panier|commande|admin|recherche)(\/|$|\?)/.test(u)));
  // Every listed URL must actually resolve.
  let broken = 0;
  for (const u of urls.slice(0, 25)) {
    const path = new URL(u).pathname;
    const r = await p.request.get(`${BASE}${path}`, { maxRedirects: 0 });
    if (r.status() !== 200) { broken++; console.log(`      ${r.status()} ${path}`); }
  }
  check("every sampled sitemap URL resolves", broken === 0, `${broken} broken`);
}

console.log("\n[12] NO CONSOLE ERRORS, NO SOURCE MAPS, NO PLACEHOLDER TEXT");
{
  // Cleared first: section [8] deliberately visits a URL that must 404, and
  // the browser logs that as a console error. Counting it here would report a
  // passing test as a broken page.
  consoleIssues.length = 0;

  for (const route of [...PUBLIC_ROUTES, "/panier", "/recherche?q=frein"]) {
    await p.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => {});
    await p.waitForTimeout(300);
  }
  const seen = new Set();
  for (const i of consoleIssues) {
    const k = i.text.slice(0, 100);
    if (!seen.has(k)) { seen.add(k); console.log(`      ${i.text}`); }
  }
  check("no console errors across the public site", consoleIssues.length === 0, `${consoleIssues.length} error(s)`);

  for (const route of PUBLIC_ROUTES) {
    const html = await (await p.request.get(`${BASE}${route}`)).text();
    check(`${route} ships no placeholder contact text`, !html.includes("à compléter"));
    check(`${route} references no source map`, !html.includes(".js.map"));
  }
  const home = await meta("/");
  check("the document declares its language", Boolean(home.lang), home.lang);
  check("no image is missing an alt attribute", home.imgsMissingAlt === 0, `${home.imgsMissingAlt} missing`);
}

console.log("\n[13] THE TAB TITLE IS THE SHOP, NOT THE FRAMEWORK");
{
  const m = await meta("/");
  check("the title names the business", /Automotive/i.test(m.title), m.title);
  check("it is not a framework default",
        !/(vite|react app|next\.?js|create-next-app|localhost)/i.test(m.title), m.title);
  const favicon = await p.request.get(`${BASE}/icon.png`);
  check("a favicon is served", favicon.status() === 200, `status=${favicon.status()}`);
}

await browser.close();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
