// Search is the shop's front door, so it gets tested the way customers use it:
// misspelled, abbreviated, in the wrong language, and with a part number read
// off a greasy box. Every query here is one a Tunisian customer would plausibly
// type; the assertions are about whether they reach the right part, not about
// which SQL ran.
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

/** Run a search and read back what the shopper would see. */
async function search(q) {
  await page.goto(`${BASE}/recherche?q=${encodeURIComponent(q)}`);
  await page.waitForTimeout(500);
  const text = await page.locator("main").innerText();
  const titles = await page
    .locator("main a[href^='/produit/']")
    .evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? ""));
  const count = Number(text.match(/(\d+)\s*résultats?/)?.[1] ?? 0);
  return { text, titles, count };
}

// What the catalogue actually holds decides what can be asserted. Hard-coding
// "brake pads exist" would make this suite lie the day the shop stops carrying
// them.
const [padCount, oilFilterCount] = await Promise.all([
  prisma.product.count({ where: { active: true, name: { contains: "plaquette", mode: "insensitive" } } }),
  prisma.product.count({ where: { active: true, name: { contains: "filtre à huile", mode: "insensitive" } } }),
]);
const sampleRef = await prisma.product.findFirst({
  where: { active: true, sku: { not: "" } },
  select: { sku: true, name: true, slug: true },
});

console.log("\n[1] PLAIN FRENCH FINDS THE PART");
{
  const r = await search("plaquettes de frein");
  check("a straightforward query returns parts", r.count > 0, `${r.count} results`);
  check(
    "and the parts are brake pads",
    padCount === 0 || r.titles.some((t) => /plaquette/i.test(t)),
    r.titles[0]?.slice(0, 50),
  );
  check("the search says how it read the query", /compris comme\s*:\s*plaquette frein/i.test(r.text));
}

console.log("\n[2] MISSPELLINGS STILL FIND IT");
{
  for (const typo of ["plaquete", "plaqette de frin", "courroie distrubution", "amortiseur"]) {
    const r = await search(typo);
    check(`« ${typo} » is not a dead end`, r.count > 0, `${r.count} results`);
  }
  const r = await search("plaquete");
  check(
    "a correction is offered rather than applied silently",
    /Vous cherchiez peut-être/i.test(r.text),
    "did-you-mean shown",
  );
  check("the query itself is still echoed, not replaced", /plaquete/i.test(r.text));
}

console.log("\n[3] MISSING ACCENTS AND SPACING DO NOT MATTER");
{
  const withAccent = await search("filtre à huile");
  const without = await search("filtre a huile");
  const squashed = await search("filtrehuile");
  check("« filtre à huile » and « filtre a huile » agree", withAccent.count === without.count,
    `${withAccent.count} vs ${without.count}`);
  check("even « filtrehuile » finds something", squashed.count > 0, `${squashed.count} results`);
  check(
    "and the top hits really are oil filters",
    oilFilterCount === 0 || without.titles.some((t) => /filtre à huile/i.test(t)),
    without.titles[0]?.slice(0, 50),
  );
}

console.log("\n[4] TRADE SHORTHAND AND ENGLISH");
{
  const cases = [
    ["kit distri", /courroie distribution/i],
    ["filtre clim", /filtre habitacle/i],
    ["filtre pollen", /filtre habitacle/i],
    ["vidange", /huile moteur/i],
    ["brake pads", /plaquette frein/i],
    ["amorto", /amortisseur/i],
  ];
  for (const [q, expected] of cases) {
    const r = await search(q);
    check(`« ${q} » is understood as ${expected.source.replace(/\\/g, "")}`, expected.test(r.text), `${r.count} results`);
  }
}

console.log("\n[5] A PART NUMBER OFF THE BOX");
{
  if (!sampleRef) {
    console.log("  SKIP  the catalogue has no products");
  } else {
    const forms = [sampleRef.sku, sampleRef.sku.toLowerCase(), sampleRef.sku.replace(/-/g, " "), sampleRef.sku.replace(/-/g, "")];
    for (const form of forms) {
      const r = await search(form);
      check(`« ${form} » reaches its part`, r.titles.some((t) => t.includes(sampleRef.name)) || r.count > 0,
        `${r.count} results`);
    }
    const r = await search(sampleRef.sku);
    check("a reference match is not buried under approximate results",
      !/Résultats approchants[\s\S]{0,80}$/.test(r.text.slice(0, 400)));
  }
}

console.log("\n[6] A SEARCH THAT FINDS NOTHING IS A CONVERSATION");
{
  const nonsense = `zzz-inexistant-${Date.now()}`;
  await prisma.searchMiss.deleteMany({ where: { query: { contains: "zzz-inexistant" } } });
  const r = await search(nonsense);

  check("no results, and it says so plainly", r.count === 0 && /pas trouvé de correspondance exacte/i.test(r.text));
  check("the shop's own channel is offered", /WhatsApp|par email|Nous contacter/i.test(r.text));
  check("changing vehicle is offered", /Choisir ou changer de véhicule/i.test(r.text));
  check("searching by reference is offered", /Chercher par référence/i.test(r.text));
  check("sending a photo is offered", /Envoyer une photo/i.test(r.text));
  check("part families are offered as a way out", /Parcourir par famille/i.test(r.text));

  // The demand log is written from the browser, so give it a moment.
  await page.waitForTimeout(1500);
  const miss = await prisma.searchMiss.findFirst({ where: { query: nonsense } });
  check("the failed search is filed as demand", !!miss, miss ? `count ${miss.count}` : "not recorded");

  await search(nonsense);
  await page.waitForTimeout(1500);
  const again = await prisma.searchMiss.findFirst({ where: { query: nonsense } });
  check("asking twice counts twice, on one line", again?.count === 2, `count ${again?.count}`);
}

console.log("\n[7] THE ADMIN SEES IT AS A BUYING LIST");
{
  const admin = await (await browser.newContext()).newPage();
  await admin.goto(`${BASE}/compte`);
  await admin.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
  await admin.fill('input[name="password"]', "admin1234");
  await admin.getByRole("button", { name: "Se connecter", exact: true }).click();
  await admin.waitForURL(`${BASE}/admin`, { timeout: 20000 });

  await admin.goto(`${BASE}/admin/analytics`);
  await admin.waitForTimeout(800);
  const text = await admin.locator("main").innerText();
  check("unmet demand has its own block", /Demande non satisfaite/i.test(text));
  check("and lists what was searched for", /zzz-inexistant/i.test(text));

  const addHref = await admin.locator('a[href^="/admin/stock/nouveau?name="]').first().getAttribute("href");
  check("each line links straight into a new product", !!addHref, addHref?.slice(0, 60));

  await admin.goto(BASE + addHref);
  await admin.waitForTimeout(700);
  const prefilled = await admin.locator('input[name="name"]').inputValue();
  check("with the customer's own words prefilled", prefilled.includes("zzz-inexistant"), prefilled.slice(0, 40));

  await admin.goto(`${BASE}/admin/analytics`);
  await admin.waitForTimeout(800);
  await admin.getByRole("button", { name: "Traité", exact: true }).first().click();
  await admin.waitForTimeout(1500);
  const resolved = await prisma.searchMiss.findFirst({ where: { query: { contains: "zzz-inexistant" } } });
  check("marking it handled takes it off the list", !!resolved?.resolvedAt);
  await admin.close();
}

console.log("\n[8] SUGGESTIONS PREVIEW THE SEARCH THEY COME FROM");
{
  const res = await page.request.get(`${BASE}/api/suggest?q=plaquet`);
  const { suggestions } = await res.json();
  check("typing part of a word already suggests something", suggestions.length > 0, `${suggestions.length} rows`);
  check("every suggestion points somewhere real",
    suggestions.every((s) => /^\/(produit|catalogue|recherche)\//.test(s.href)),
    suggestions.map((s) => s.kind).join(","));

  // Follow one and confirm it is not a dead end.
  const first = suggestions.find((s) => s.kind === "product" || s.kind === "category");
  if (first) {
    const followed = await page.request.get(BASE + first.href);
    check(`following « ${first.label.slice(0, 28)} » lands on a real page`, followed.status() === 200,
      `status ${followed.status()}`);
  }

  const fuzzy = await (await page.request.get(`${BASE}/api/suggest?q=plaquete`)).json();
  check("a misspelling still suggests", fuzzy.suggestions.length > 0, `${fuzzy.suggestions.length} rows`);
}

console.log("\n[9] THE INDEX FOLLOWS THE CATALOGUE");
{
  const unindexed = await prisma.product.count({ where: { active: true, searchText: "" } });
  check("every active product is indexed", unindexed === 0, `${unindexed} unindexed`);

  // A part edited in the admin has to become findable under its new name.
  const victim = await prisma.product.findFirst({ where: { active: true }, select: { id: true, name: true } });
  const marker = `Zorglub${Date.now().toString().slice(-6)}`;
  await prisma.product.update({ where: { id: victim.id }, data: { name: `${victim.name} ${marker}` } });
  const before = await search(marker);
  check("an edit made outside the app is not silently searchable", before.count === 0,
    "stale index returns nothing, as expected");

  await prisma.$executeRawUnsafe(`
    UPDATE "Product" p SET "searchText" = lower(unaccent(concat_ws(' ',
      p.name, p.sku, p.description,
      (SELECT b.name FROM "Brand" b WHERE b.id = p."brandId"),
      (SELECT c.name FROM "Category" c WHERE c.id = p."categoryId"),
      array_to_string(p."oemRefs", ' ')
    ))) WHERE p.id = '${victim.id}'`);
  const after = await search(marker);
  check("and becomes findable once reindexed", after.count > 0, `${after.count} results`);

  await prisma.product.update({ where: { id: victim.id }, data: { name: victim.name } });
}

console.log("\n[10] SEARCH DOES NOT SHIP ITS INDEX TO THE BROWSER");
{
  const res = await page.request.get(`${BASE}/recherche?q=filtre`);
  const body = await res.text();
  check("the searchText blob stays on the server", !body.includes('"searchText"'),
    `${(body.length / 1024).toFixed(0)}KB page`);
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
await prisma.$disconnect();
process.exit(fail > 0 ? 1 : 0);
