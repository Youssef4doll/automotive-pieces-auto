// Four things the shop reported about filling the catalogue in.
//
//   1. Adding a category looked like it did nothing — the home page did not
//      change and nothing said why.
//   2. A brand could not be given a logo at all: the only input was a path on
//      a server the shop has no way to put a file on.
//   3. The vehicle board was a strip of thin rows next to the family board,
//      doing the same job at a fraction of the weight.
//   4. The product form's category picker was a native select over a hundred
//      and forty options, searchable only by first letter.
//
// Each one is checked here the way it was reported: from the admin's chair,
// through the real screens, with a shopper's view of the same page as the
// control.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waitForAdmin } from "./lib/wait-for-admin.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const STAMP = Date.now();
const CAT_NAME = `Zzz Test Famille ${STAMP}`;
const BRAND_NAME = `Zzz Test Marque ${STAMP}`;

const FIXTURES = mkdtempSync(join(tmpdir(), "catalog-authoring-"));
writeFileSync(
  join(FIXTURES, "logo.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 24"><rect width="64" height="24" rx="4" fill="#0b1b3a"/><circle cx="16" cy="12" r="6" fill="#f5c518"/></svg>\n`,
);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const admin = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
admin.on("pageerror", (e) => console.log("  PAGE ERROR:", e.message));

await admin.goto(`${BASE}/compte`);
await admin.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
await admin.fill('input[name="password"]', "admin1234");
await admin.getByRole("button", { name: "Se connecter", exact: true }).click();
await waitForAdmin(admin, BASE);

let createdCategoryId = null;
let createdBrandId = null;
const createdAssetIds = [];

/* ------------------------------------------------------------------ */
console.log("\n[1] A NEW CATEGORY SHOWS UP WHERE THE ADMIN LOOKS FOR IT");
{
  await admin.goto(`${BASE}/admin/catalogue`);
  await admin.waitForTimeout(700);
  await admin.getByRole("button", { name: /Nouvelle famille/i }).click();
  await admin.waitForTimeout(300);
  const form = admin.locator("form").filter({ has: admin.locator('input[name="name"]') }).first();
  await form.locator('input[name="name"]').fill(CAT_NAME);
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await admin.waitForTimeout(1600);

  const cat = await prisma.category.findFirst({ where: { name: CAT_NAME }, select: { id: true, slug: true } });
  check("the category was created", !!cat);
  createdCategoryId = cat.id;

  // The actual complaint: it was created, and the home page did not change.
  await admin.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await admin.waitForTimeout(500);
  const tile = admin.locator("button", { hasText: CAT_NAME });
  check("the admin now sees it on the home page", await tile.count() === 1, `${await tile.count()} tile(s)`);
  check(
    "and it says it is not live yet",
    /masqu/i.test(await tile.first().innerText()),
    (await tile.first().innerText()).replace(/\n/g, " · "),
  );

  // The other half of the contract: it stays off the shopper's board, because
  // a tile that opens onto nothing is a dead end.
  const shopper = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await shopper.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await shopper.waitForTimeout(400);
  check("a shopper does not see the empty family", await shopper.locator("button", { hasText: CAT_NAME }).count() === 0);
  // And the stocked families are still on both boards, so hiding empties has
  // not quietly hidden anything real.
  // Parts are filed in subcategories, so a family is stocked when its children
  // are — asking for products directly on the family finds nothing and would
  // have skipped this check silently.
  const stocked = await prisma.category.findFirst({
    where: {
      parentId: null,
      OR: [{ products: { some: {} } }, { children: { some: { products: { some: {} } } } }],
    },
    select: { name: true },
  });
  check("there is a stocked family to compare against", !!stocked);
  if (stocked) {
    check(
      `a stocked family is still shown to shoppers — ${stocked.name}`,
      await shopper.locator("button", { hasText: stocked.name }).count() > 0,
    );
  }
  await shopper.context().close();
}

/* ------------------------------------------------------------------ */
console.log("\n[2] A BRAND CAN BE GIVEN A LOGO");
{
  await admin.goto(`${BASE}/admin/catalogue/marques`);
  await admin.waitForTimeout(700);
  await admin.getByRole("button", { name: /Nouvelle marque/i }).click();
  await admin.waitForTimeout(300);

  const form = admin.locator("form").filter({ has: admin.locator('input[name="name"]') }).first();
  // The whole point: there is a file input here at all. Before this there was
  // only a text box asking for a path on the server.
  check("the brand form takes a file", await form.locator('input[type="file"]').count() === 1);

  await form.locator('input[name="name"]').fill(BRAND_NAME);
  await form.locator('input[type="file"]').setInputFiles(join(FIXTURES, "logo.svg"));
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await admin.waitForTimeout(1800);

  const brand = await prisma.brand.findFirst({ where: { name: BRAND_NAME }, select: { id: true, logoUrl: true } });
  check("the brand was created", !!brand);
  createdBrandId = brand.id;
  check("with an uploaded logo", (brand.logoUrl || "").startsWith("/api/images/"), String(brand.logoUrl));
  check("stored as a vector", (brand.logoUrl || "").endsWith(".svg"), String(brand.logoUrl));
  createdAssetIds.push(brand.logoUrl.replace("/api/images/", "").replace(/\.svg$/, ""));

  const res = await admin.request.get(`${BASE}${brand.logoUrl}`);
  check("the logo is served", res.status() === 200, `HTTP ${res.status()}`);

  await admin.reload();
  await admin.waitForTimeout(900);
  const row = admin.locator("li", { hasText: BRAND_NAME }).first();
  check("the list shows the logo back", await row.locator("img").count() > 0);

  // The trap the banner form fell into: an uploaded picture has no path to put
  // in the text box, so an edit that touches only the name must not read the
  // empty box as "remove the logo".
  await row.getByLabel("Modifier").click();
  await admin.waitForTimeout(400);
  const editForm = row.locator("form").first();
  check("it says the logo is an upload it will keep", await editForm.getByText(/téléversé/i).count() > 0);
  await editForm.locator('input[name="name"]').fill(`${BRAND_NAME} bis`);
  await editForm.getByRole("button", { name: "Enregistrer" }).click();
  await admin.waitForTimeout(1800);

  const after = await prisma.brand.findUnique({ where: { id: createdBrandId }, select: { name: true, logoUrl: true } });
  check("renaming saved", after.name === `${BRAND_NAME} bis`, after.name);
  check("and the logo survived the rename", after.logoUrl === brand.logoUrl, `${brand.logoUrl} -> ${after.logoUrl}`);
}

/* ------------------------------------------------------------------ */
console.log("\n[3] THE VEHICLE BOARD IS THE SAME WEIGHT AS THE FAMILY BOARD");
{
  const shopper = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await shopper.goto(`${BASE}/`, { waitUntil: "networkidle" });

  const vehicleCard = shopper.locator('a[href^="/pieces/"]').first();
  const hasVehicles = await vehicleCard.count() > 0;
  if (!hasVehicles) {
    console.log("  (no vehicle pages with parts — section is hidden by design, nothing to measure)");
  } else {
    const card = await vehicleCard.boundingBox();
    // It used to be a single line barely taller than a tap target.
    check("a vehicle card is a card, not a row", !!card && card.height >= 72, card ? `${Math.round(card.height)}px tall` : "no box");

    const logo = await vehicleCard.locator("span").first().boundingBox();
    check("its logo is big enough to recognise", !!logo && logo.width >= 48, logo ? `${Math.round(logo.width)}px` : "no box");

    // The count was a bare number in the corner with nothing saying what it
    // counted.
    check("the count says what it counts", /pièce/i.test(await vehicleCard.innerText()), (await vehicleCard.innerText()).replace(/\n/g, " · "));

    // Not measured against the family tile: that one is a square built around
    // a picture, and a card holding a logo and two lines of text has no
    // business being 260px tall. What matters is that the model name is the
    // loudest thing in the card and reads at a glance, which is what a bare
    // 13px line in a 44px row did not do.
    const nameSize = await vehicleCard.evaluate((a) => {
      const spans = [...a.querySelectorAll("span")];
      return Math.max(...spans.map((s) => parseFloat(getComputedStyle(s).fontSize) || 0));
    });
    check("the model name reads at a glance", nameSize >= 15, `${nameSize}px`);

    await shopper.setViewportSize({ width: 390, height: 844 });
    await shopper.waitForTimeout(400);
    const phone = await vehicleCard.boundingBox();
    check("it still fits two-up on a phone", !!phone && phone.width < 200, phone ? `${Math.round(phone.width)}px` : "no box");
    const scrolls = await shopper.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check("and the page does not scroll sideways", !scrolls);
  }
  await shopper.context().close();
}

/* ------------------------------------------------------------------ */
console.log("\n[4] THE CATEGORY PICKER CAN BE TYPED INTO");
{
  await admin.goto(`${BASE}/admin/stock/nouveau`);
  await admin.waitForTimeout(1000);

  const combo = admin.locator('[role="combobox"]').first();
  check("the picker is a combobox, not a plain select", await combo.count() > 0);
  check("there is no native category select left", await admin.locator('select[name="categoryId"]').count() === 0);

  // The example the shop gave: type a few letters and see the matches.
  await combo.click();
  await admin.waitForTimeout(250);
  const total = await admin.locator('[role="option"]').count();
  check("everything is listed before typing", total > 20, `${total} option(s)`);

  await combo.fill("ecl");
  await admin.waitForTimeout(350);
  const rows = admin.locator('[role="option"]');
  const shown = await rows.count();
  check("typing narrows the list", shown > 0 && shown < total, `${shown} of ${total}`);

  const texts = await rows.allInnerTexts();
  const folded = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  check("the shop's own example works — « ecl » finds Eclairage", texts.some((t) => /eclairage/i.test(folded(t))), texts.slice(0, 4).join(" | "));
  check("and nothing unrelated survives", texts.every((t) => folded(t).includes("ecl")), texts.slice(0, 4).join(" | "));

  // Accent folding, tested the only way that means anything: type the plain
  // letters and find the category that is actually spelled with an accent.
  const accented = await prisma.category.findFirst({
    where: { name: { contains: "préchauffage" } },
    select: { name: true },
  });
  await combo.fill("prechauffage");
  await admin.waitForTimeout(350);
  const accentRows = await rows.allInnerTexts();
  check(
    `typing without accents finds ${accented?.name ?? "an accented name"}`,
    accentRows.some((t) => /préchauffage/i.test(t)),
    accentRows.slice(0, 3).join(" | ") || "(nothing)",
  );

  // Matching in the middle of a word, not just at the start — a native select
  // could only ever do the start.
  await combo.fill("bougie");
  await admin.waitForTimeout(350);
  const mid = await rows.allInnerTexts();
  check("it matches inside the name too", mid.length > 0 && mid.some((t) => /bougie/i.test(t)), mid.slice(0, 3).join(" | "));

  // A subcategory is findable by its family's name.
  await combo.fill("frein");
  await admin.waitForTimeout(350);
  check("a family name finds its children", (await rows.count()) > 1, `${await rows.count()} row(s)`);

  // Picking one has to fill the field the form actually posts.
  await rows.first().click();
  await admin.waitForTimeout(300);
  const posted = await admin.locator('input[type="hidden"][name="categoryId"]').inputValue();
  check("choosing one sets the posted value", posted.length > 10, posted || "(empty)");
  check("and the box shows what was chosen", (await combo.inputValue()).length > 0, await combo.inputValue());

  const chosen = await prisma.category.findUnique({ where: { id: posted }, select: { name: true } });
  check("the value is a real category", !!chosen, chosen?.name);

  // Escape closes without losing the selection.
  await combo.click();
  await admin.waitForTimeout(200);
  await combo.press("Escape");
  await admin.waitForTimeout(200);
  check("Escape keeps the selection", (await admin.locator('input[type="hidden"][name="categoryId"]').inputValue()) === posted);

  // And it still saves a product, which is what the screen is for.
  const sku = `ZZZ-${STAMP}`;
  await admin.locator('input[name="sku"]').fill(sku);
  await admin.locator('input[name="name"]').fill(`Zzz Test Pièce ${STAMP}`);
  await admin.locator('input[name="priceBuy"]').fill("10");
  await admin.locator('input[name="priceSell"]').fill("20");
  await admin.getByRole("button", { name: /Enregistrer|Ajouter/i }).first().click();
  await admin.waitForTimeout(2200);

  const saved = await prisma.product.findFirst({ where: { sku }, select: { id: true, categoryId: true } });
  check("the product saved", !!saved);
  if (saved) {
    check("filed under the category that was typed for", saved.categoryId === posted, `${saved.categoryId} vs ${posted}`);
    await prisma.product.delete({ where: { id: saved.id } });
  }
}

/* ------------------------------------------------------------------ */
console.log("\n[5] PUTTING THE SHOP BACK");
{
  if (createdBrandId) await prisma.brand.deleteMany({ where: { id: createdBrandId } });
  if (createdCategoryId) await prisma.category.deleteMany({ where: { id: createdCategoryId } });
  await prisma.mediaAsset.deleteMany({ where: { id: { in: createdAssetIds } } });

  check("no test category left", (await prisma.category.count({ where: { name: { contains: "Zzz Test Famille" } } })) === 0);
  check("no test brand left", (await prisma.brand.count({ where: { name: { contains: "Zzz Test Marque" } } })) === 0);
  check("no test product left", (await prisma.product.count({ where: { sku: { startsWith: "ZZZ-" } } })) === 0);
  check("no test artwork left", (await prisma.mediaAsset.count({ where: { id: { in: createdAssetIds } } })) === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
