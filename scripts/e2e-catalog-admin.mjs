// Proves the admin catalogue is really wired to the database: what an admin
// creates, renames, reorders or deletes must land in Postgres AND show up on
// the public storefront, and the guard rails must refuse destructive edits.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const FAM = "Zone Test QA";
const FAM_SLUG = "zone-test-qa";
const FAM_RENAMED = "Zone Test QA Renommee";
const SUB = "Sous Test QA";
const SUB_SLUG = "sous-test-qa";
const BRAND = "MarqueTestQA";

// Leave no residue behind if a previous run died halfway.
async function cleanup() {
  await prisma.category.deleteMany({ where: { slug: { in: [SUB_SLUG, FAM_SLUG] } } });
  await prisma.brand.deleteMany({ where: { name: BRAND } });
}
await cleanup();

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("  PAGE ERROR:", e.message));

// ---------- log in as admin ----------
await page.goto(`${BASE}/compte`);
await page.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
await page.fill('input[name="password"]', "admin1234");
await page.getByRole("button", { name: "Se connecter", exact: true }).click();
await page.waitForURL(`${BASE}/admin`, { timeout: 15000 });

console.log("\n[1] CREATE A FAMILY IN ADMIN");
await page.goto(`${BASE}/admin/catalogue`);
await page.waitForTimeout(800);
await page.click('button:has-text("+ Nouvelle famille")');
await page.waitForTimeout(300);
await page.fill('input[name="name"]', FAM);
await page.click('form button:has-text("Enregistrer")');
await page.waitForTimeout(1500);

const created = await prisma.category.findUnique({ where: { slug: FAM_SLUG } });
check("family stored in the database", !!created, created ? `id=${created.id} order=${created.order}` : "not found");
check("slug generated from the name", created?.slug === FAM_SLUG, created?.slug);

console.log("\n[2] IT APPEARS ON THE PUBLIC STOREFRONT");
{
  const shop = await (await browser.newContext()).newPage();
  const res = await shop.goto(`${BASE}/catalogue/${FAM_SLUG}`);
  check("its /catalogue page is live", res.status() === 200, `status=${res.status()}`);
  const body = await shop.locator("main").innerText();
  check("the page shows the new family name", body.includes(FAM.toUpperCase()) || body.includes(FAM), body.split("\n")[2] ?? "");

  await shop.goto(BASE);
  await shop.waitForTimeout(700);
  const home = await shop.content();
  check("it is listed in the storefront navigation", home.includes(FAM_SLUG));
  await shop.close();
}

console.log("\n[3] ADD A SUBCATEGORY UNDER IT");
await page.goto(`${BASE}/admin/catalogue`);
await page.waitForTimeout(800);
await page.click(`button:has-text("${FAM}")`);
await page.waitForTimeout(400);
await page.click(`button:has-text("Ajouter une sous-catégorie")`);
await page.waitForTimeout(300);
const subForm = page.locator('form:has(input[name="parentId"])').last();
await subForm.locator('input[name="name"]').fill(SUB);
await subForm.locator('button:has-text("Enregistrer")').click();
await page.waitForTimeout(1500);

const sub = await prisma.category.findUnique({ where: { slug: SUB_SLUG }, select: { id: true, parentId: true } });
check("subcategory stored", !!sub);
check("it is nested under the right family", sub?.parentId === created?.id);
{
  const shop = await (await browser.newContext()).newPage();
  const res = await shop.goto(`${BASE}/catalogue/${FAM_SLUG}/${SUB_SLUG}`);
  check("its nested /catalogue URL is live", res.status() === 200, `status=${res.status()}`);
  await shop.close();
}

console.log("\n[4] GUARD RAIL: A FAMILY WITH CHILDREN CANNOT BE DELETED");
await page.goto(`${BASE}/admin/catalogue`);
await page.waitForTimeout(800);
const famRow = page.locator("li").filter({ hasText: FAM }).first();
await famRow.locator('button[aria-label="Supprimer"]').first().click();
await page.waitForTimeout(1500);
const stillThere = await prisma.category.findUnique({ where: { slug: FAM_SLUG } });
check("the family survived the delete attempt", !!stillThere);
check("the admin is told why", (await page.locator("text=sous-catégorie").count()) > 0);

console.log("\n[5] RENAME, AND THE STOREFRONT FOLLOWS");
await page.goto(`${BASE}/admin/catalogue`);
await page.waitForTimeout(800);
const row = page.locator("li").filter({ hasText: FAM }).first();
await row.locator('button[aria-label="Modifier"]').first().click();
await page.waitForTimeout(400);
const editForm = page.locator("form").filter({ has: page.locator('input[name="name"]') }).first();
await editForm.locator('input[name="name"]').fill(FAM_RENAMED);
await editForm.locator('input[name="slug"]').fill(FAM_SLUG); // keep the URL stable
await editForm.locator('button:has-text("Enregistrer")').click();
await page.waitForTimeout(1500);

const renamed = await prisma.category.findUnique({ where: { slug: FAM_SLUG } });
check("new name persisted to the database", renamed?.name === FAM_RENAMED, renamed?.name);
{
  const shop = await (await browser.newContext()).newPage();
  await shop.goto(`${BASE}/catalogue/${FAM_SLUG}`);
  const body = await shop.locator("main").innerText();
  check("storefront shows the new name", body.toUpperCase().includes(FAM_RENAMED.toUpperCase()));
  await shop.close();
}

console.log("\n[6] BRANDS");
await page.goto(`${BASE}/admin/catalogue/marques`);
await page.waitForTimeout(800);
await page.click('button:has-text("+ Nouvelle marque")');
await page.waitForTimeout(300);
await page.fill('input[name="name"]', BRAND);
await page.click('form button:has-text("Enregistrer")');
await page.waitForTimeout(1500);
const brand = await prisma.brand.findFirst({ where: { name: BRAND } });
check("brand stored in the database", !!brand, brand?.slug);

await page.goto(`${BASE}/admin/stock/nouveau`);
await page.waitForTimeout(800);
const brandOptions = await page.locator('select[name="brandId"]').innerText();
check("the new brand is selectable on the product form", brandOptions.includes(BRAND));

console.log("\n[7] A PRODUCT EDIT REACHES THE SHOP");
const demo = await prisma.product.findFirst({ where: { active: true }, select: { id: true, slug: true, priceSell: true } });
const newPrice = 123.45;
await page.goto(`${BASE}/admin/stock/${demo.id}`);
await page.waitForTimeout(900);
await page.fill('input[name="priceSell"]', String(newPrice));
await page.click('button:has-text("Enregistrer")');
await page.waitForTimeout(1800);
const after = await prisma.product.findUnique({ where: { id: demo.id }, select: { priceSell: true } });
check("price persisted", Number(after.priceSell) === newPrice, `${after.priceSell}`);
{
  const shop = await (await browser.newContext()).newPage();
  await shop.goto(`${BASE}/produit/${demo.slug}`);
  await shop.waitForTimeout(600);
  const body = await shop.locator("main").innerText();
  check("shopper sees the new price", body.includes("123.45"), body.includes("123.45") ? "" : "price not on page");
  await shop.close();
}
await prisma.product.update({ where: { id: demo.id }, data: { priceSell: demo.priceSell } });

console.log("\n[8] DELETE CLEANLY, AND IT LEAVES THE STOREFRONT");
await page.goto(`${BASE}/admin/catalogue`);
await page.waitForTimeout(800);
await page.click(`button:has-text("${FAM_RENAMED}")`);
await page.waitForTimeout(500);
const subRow = page.locator("div").filter({ hasText: SUB }).last();
await subRow.locator('button[aria-label="Supprimer"]').last().click();
await page.waitForTimeout(1500);
check("subcategory deleted", !(await prisma.category.findUnique({ where: { slug: SUB_SLUG } })));

await page.goto(`${BASE}/admin/catalogue`);
await page.waitForTimeout(800);
await page.locator("li").filter({ hasText: FAM_RENAMED }).first().locator('button[aria-label="Supprimer"]').first().click();
await page.waitForTimeout(1500);
check("family deleted once empty", !(await prisma.category.findUnique({ where: { slug: FAM_SLUG } })));
{
  const shop = await (await browser.newContext()).newPage();
  const res = await shop.goto(`${BASE}/catalogue/${FAM_SLUG}`);
  check("its storefront page is gone (404)", res.status() === 404, `status=${res.status()}`);
  await shop.close();
}

await page.goto(`${BASE}/admin/catalogue/marques`);
await page.waitForTimeout(800);
await page.locator("li").filter({ hasText: BRAND }).first().locator('button[aria-label="Supprimer"]').click();
await page.waitForTimeout(1500);
check("brand deleted", !(await prisma.brand.findFirst({ where: { name: BRAND } })));

await cleanup();
await browser.close();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
