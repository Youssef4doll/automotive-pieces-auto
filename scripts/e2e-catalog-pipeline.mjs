// The data pipeline: a supplier CSV goes in, is validated, previewed, applied,
// becomes findable by reference, and can be rolled back. Plus the storefront
// rules that must hold at any catalogue size.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const STAMP = Date.now().toString().slice(-6);
const CAT = `Zone Import ${STAMP}`;
const SKUS = [`IMP-${STAMP}-1`, `IMP-${STAMP}-2`, `IMP-${STAMP}-3`];
const OEM = `77 01 ${STAMP}`;

async function cleanup() {
  const prods = await prisma.product.findMany({ where: { sku: { startsWith: `IMP-${STAMP}` } }, select: { id: true } });
  const ids = prods.map((p) => p.id);
  if (ids.length) {
    await prisma.partReference.deleteMany({ where: { productId: { in: ids } } });
    await prisma.productImage.deleteMany({ where: { productId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { productId: { in: ids } } });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.importBatch.deleteMany({ where: { filename: { contains: STAMP } } });
  await prisma.category.deleteMany({ where: { slug: { contains: `zone-import-${STAMP}` } } });
  await prisma.brand.deleteMany({ where: { name: `MarqueImp${STAMP}` } });
}
await cleanup();

// A deliberately messy file: semicolon-separated (French Excel), comma decimals,
// a currency suffix, an accented header, a duplicate SKU and a row with no price.
const dir = mkdtempSync(join(tmpdir(), "imp-"));
const csvPath = join(dir, `fournisseur-${STAMP}.csv`);
writeFileSync(
  csvPath,
  "﻿Référence;Désignation;Catégorie;Marque;Prix de vente;Prix d'achat;Stock;OEM;Essieu\n" +
    `${SKUS[0]};Plaquettes de frein avant TEST ${STAMP};${CAT};MarqueImp${STAMP};"149,90 DT";80,00;7;${OEM};Avant\n` +
    `${SKUS[1]};Disque de frein arrière TEST ${STAMP};${CAT};MarqueImp${STAMP};199,00;120,00;4;;Arrière\n` +
    `${SKUS[2]};Ligne sans prix ${STAMP};${CAT};MarqueImp${STAMP};;50,00;2;;\n` +
    `${SKUS[0]};Doublon ${STAMP};${CAT};MarqueImp${STAMP};10,00;5,00;1;;\n`,
  "utf8",
);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext();
const admin = await ctx.newPage();
admin.on("pageerror", (e) => console.log("  JS ERROR:", e.message));
await admin.goto(`${BASE}/compte`);
await admin.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
await admin.fill('input[name="password"]', "admin1234");
await admin.getByRole("button", { name: "Se connecter", exact: true }).click();
await admin.waitForURL(`${BASE}/admin`, { timeout: 15000 });

console.log("\n[1] UPLOAD AND VALIDATE — NOTHING WRITTEN YET");
await admin.goto(`${BASE}/admin/import`);
await admin.waitForTimeout(700);
await admin.setInputFiles('input[type="file"]', csvPath);
await admin.click('button:has-text("Analyser le fichier")');
await admin.waitForTimeout(2500);

const batch = await prisma.importBatch.findFirst({ where: { filename: { contains: STAMP } } });
check("a draft batch was created", !!batch && batch.status === "DRAFT", batch?.status);
check("all 4 rows parsed", batch?.rowCount === 4, String(batch?.rowCount));
check("the duplicate SKU and the priceless row were rejected", batch?.errorCount === 2, `${batch?.errorCount} errors`);
check("2 rows queued to create", batch?.createdCount === 2, String(batch?.createdCount));
check("NOTHING was written to the catalogue yet",
      (await prisma.product.count({ where: { sku: { startsWith: `IMP-${STAMP}` } } })) === 0);

const body = await admin.locator("main").innerText();
check("the operator is told why rows were rejected", /double|Prix de vente illisible/i.test(body));

console.log("\n[2] APPLY");
if ((await admin.locator('button:has-text("Importer")').count()) === 0) {
  await admin.locator(`button:has-text("fournisseur-${STAMP}.csv")`).first().click();
  await admin.waitForTimeout(600);
}
await admin.locator('button:has-text("Importer")').first().click();
await admin.waitForTimeout(3500);

const created = await prisma.product.findMany({
  where: { sku: { startsWith: `IMP-${STAMP}` } },
  select: { sku: true, name: true, priceSell: true, priceBuy: true, stockQty: true, axle: true, importBatchId: true,
            references: { select: { type: true, normalized: true, raw: true } } },
});
check("2 products created", created.length === 2, `${created.length}`);
const p1 = created.find((p) => p.sku === SKUS[0]);
check('"149,90 DT" parsed as 149.90', Number(p1?.priceSell) === 149.9, String(p1?.priceSell));
check("comma decimal on cost parsed", Number(p1?.priceBuy) === 80, String(p1?.priceBuy));
check("stock imported", p1?.stockQty === 7, String(p1?.stockQty));
check("axle read from the Essieu column", p1?.axle === "AVANT", String(p1?.axle));
check("the category named in the file was created",
      !!(await prisma.category.findFirst({ where: { name: CAT } })));
check("the brand named in the file was created",
      !!(await prisma.brand.findFirst({ where: { name: `MarqueImp${STAMP}` } })));
check("products are tagged with their import batch", p1?.importBatchId === batch.id);

const ref = p1?.references.find((r) => r.type === "OEM");
check("the OEM reference was stored", !!ref, ref?.raw);
check("and normalised for matching", ref?.normalized === OEM.replace(/\s/g, ""), ref?.normalized);

console.log("\n[3] THE REFERENCE IS NOW FINDABLE — IN ANY WRITTEN FORM");
{
  const shop = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  for (const form of [OEM, OEM.replace(/\s/g, ""), OEM.replace(/ /g, "-"), OEM.toLowerCase()]) {
    await shop.goto(`${BASE}/recherche?q=${encodeURIComponent(form)}`);
    await shop.waitForTimeout(700);
    const found = (await shop.locator(`text=Plaquettes de frein avant TEST ${STAMP}`).count()) > 0;
    check(`  "${form}" finds the part`, found);
  }
  await shop.close();
}

console.log("\n[4] EMPTY CATEGORIES STAY OUT OF THE SHOP");
{
  const shop = await (await browser.newContext()).newPage();
  await shop.goto(BASE);
  await shop.waitForTimeout(900);
  const html = await shop.content();
  const empties = await prisma.category.findMany({
    where: { parentId: { not: null }, products: { none: {} } },
    select: { slug: true }, take: 40,
  });
  const leaked = empties.filter((c) => html.includes(`/${c.slug}"`));
  check("no empty subcategory is linked from the storefront", leaked.length === 0,
        leaked.length ? leaked.slice(0, 3).map((c) => c.slug).join(", ") : `${empties.length} empty, 0 shown`);

  const stocked = await prisma.category.findFirst({
    where: { parentId: { not: null }, products: { some: { active: true } } },
    select: { slug: true },
  });
  check("a stocked subcategory IS still linked", html.includes(stocked.slug), stocked.slug);
  await shop.close();
}

console.log("\n[5] SEO INFRASTRUCTURE");
{
  const sm = await admin.request.get(`${BASE}/sitemap.xml`);
  const xml = await sm.text();
  check("sitemap.xml is served", sm.status() === 200 && xml.includes("<urlset"), `status=${sm.status()}`);
  check("it lists products", xml.includes("/produit/"));
  const emptyCat = await prisma.category.findFirst({
    where: { parentId: { not: null }, products: { none: {} } }, select: { slug: true },
  });
  check("it does NOT list empty categories", !xml.includes(`/${emptyCat.slug}<`), emptyCat.slug);

  const rb = await admin.request.get(`${BASE}/robots.txt`);
  const txt = await rb.text();
  check("robots.txt is served", rb.status() === 200 && /User-Agent/i.test(txt));
  check("it points at the sitemap", /Sitemap:/i.test(txt));
  check("it keeps crawlers out of admin and account", /Disallow.*\/admin/i.test(txt) && /Disallow.*\/compte/i.test(txt));
}

console.log("\n[6] CATALOGUE QUALITY DASHBOARD");
await admin.goto(`${BASE}/admin/qualite`);
await admin.waitForTimeout(1200);
const qBody = await admin.locator("main").innerText();
check("the quality page renders", /Qualité catalogue/i.test(qBody));
check("it counts products missing a reference", /Sans référence/i.test(qBody));
await admin.goto(`${BASE}/admin/qualite?missing=photo`);
await admin.waitForTimeout(900);
const rows = await admin.locator("tbody tr").count();
check("filtering by 'sans photo' lists real products", rows > 0, `${rows} rows`);

console.log("\n[7] ROLLBACK");
await admin.goto(`${BASE}/admin/import`);
await admin.waitForTimeout(900);
// Expand only if the action is genuinely not on screen — clicking the header
// when it is already open would collapse it and hide the button.
if ((await admin.locator('button:has-text("Annuler cet import")').count()) === 0) {
  await admin.locator(`button:has-text("fournisseur-${STAMP}.csv")`).first().click();
  await admin.waitForTimeout(600);
}
await admin.locator('button:has-text("Annuler cet import")').first().click();
await admin.waitForTimeout(3000);
check("the imported products were removed",
      (await prisma.product.count({ where: { sku: { startsWith: `IMP-${STAMP}` } } })) === 0);
check("the batch is marked rolled back",
      (await prisma.importBatch.findUnique({ where: { id: batch.id }, select: { status: true } }))?.status === "ROLLED_BACK");

await cleanup();
await browser.close();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
