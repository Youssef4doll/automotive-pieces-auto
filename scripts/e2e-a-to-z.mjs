// A to Z: an admin creates a category, a brand and a brand-new product with a
// photo; a brand-new customer registers, finds that product by search and by
// reference, buys it, and tracks the order while the admin advances it.
// Everything asserted against Postgres, not just the screen.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PICS = process.env.PICS_DIR;
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

/**
 * The demand log is a business record, so QA traffic must not reach it: these
 * suites search for deliberately unfindable things, and every one of those
 * became a line on the shop's buying list.
 */
async function sweepTestDemand() {
  await prisma.searchMiss.deleteMany({
    where: {
      OR: [
        { normalized: { contains: "zorglub" } },
        { normalized: { contains: "piecequinexistepas" } },
        { normalized: { contains: "zzz" } },
        { normalized: { contains: "inexistant" } },
        { query: { startsWith: "AZ-" } },
        { query: { startsWith: "IMP-" } },
      ],
    },
  });
}

const STAMP = Date.now().toString().slice(-6);
const FAM = `Zone AZ ${STAMP}`;
const FAM_SLUG = `zone-az-${STAMP}`;
const SUB = `Sous AZ ${STAMP}`;
const SUB_SLUG = `sous-az-${STAMP}`;
const BRAND = `MarqueAZ${STAMP}`;
const SKU = `AZ-${STAMP}`;
const PRODUCT = `Amortisseur avant AZ ${STAMP}`;
const EMAIL = `client.az.${STAMP}@example.com`;
const PASSWORD = "client1234";

/**
 * Sweeps every run's fixtures, not just this one's.
 *
 * Scoping cleanup to this run's stamp meant a run that crashed mid-way left
 * its category and its products in the database for good — and they showed up
 * on the live storefront as a family called "Zone AZ 338804". Matching the
 * prefix instead means the next run clears up after the last one's crash.
 */
async function cleanup() {
  const prods = await prisma.product.findMany({
    where: { OR: [{ sku: { startsWith: "AZ-" } }, { name: { startsWith: "Amortisseur avant AZ " } }] },
    select: { id: true },
  });
  const prodIds = prods.map((x) => x.id);
  if (prodIds.length) {
    await prisma.productImage.deleteMany({ where: { productId: { in: prodIds } } });
    await prisma.partReference.deleteMany({ where: { productId: { in: prodIds } } });
    await prisma.productFitment.deleteMany({ where: { productId: { in: prodIds } } });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: prodIds } } });
    await prisma.cartItem.deleteMany({ where: { productId: { in: prodIds } } });
    await prisma.orderItem.deleteMany({ where: { productId: { in: prodIds } } });
    await prisma.product.deleteMany({ where: { id: { in: prodIds } } });
  }
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  if (user) {
    const orders = await prisma.order.findMany({ where: { userId: user.id }, select: { id: true } });
    const ids = orders.map((o) => o.id);
    if (ids.length) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
      await prisma.orderStatusEvent.deleteMany({ where: { orderId: { in: ids } } });
      await prisma.order.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.category.deleteMany({ where: { slug: { startsWith: "sous-az-" } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: "zone-az-" } } });
  await prisma.brand.deleteMany({ where: { name: { startsWith: "MarqueAZ" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "client.az." } } });
}
await cleanup();

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const adminCtx = await browser.newContext();
const admin = await adminCtx.newPage();
admin.on("pageerror", (e) => console.log("  ADMIN JS ERROR:", e.message));

await admin.goto(`${BASE}/compte`);
await admin.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
await admin.fill('input[name="password"]', "admin1234");
await admin.getByRole("button", { name: "Se connecter", exact: true }).click();
await admin.waitForURL(`${BASE}/admin`, { timeout: 15000 });

console.log("\n[1] ADMIN BUILDS THE CATALOGUE ENTRY");
await admin.goto(`${BASE}/admin/catalogue`);
await admin.waitForTimeout(700);
await admin.click('button:has-text("+ Nouvelle famille")');
await admin.fill('input[name="name"]', FAM);
await admin.click('form button:has-text("Enregistrer")');
await admin.waitForTimeout(1400);
await admin.click(`button:has-text("${FAM}")`);
await admin.waitForTimeout(400);
await admin.click('button:has-text("Ajouter une sous-catégorie")');
await admin.waitForTimeout(300);
const subForm = admin.locator('form:has(input[name="parentId"])').last();
await subForm.locator('input[name="name"]').fill(SUB);
await subForm.locator('button:has-text("Enregistrer")').click();
await admin.waitForTimeout(1400);
const subCat = await prisma.category.findUnique({ where: { slug: SUB_SLUG }, select: { id: true } });
check("family + subcategory created", !!subCat);

await admin.goto(`${BASE}/admin/catalogue/marques`);
await admin.waitForTimeout(700);
await admin.click('button:has-text("+ Nouvelle marque")');
await admin.fill('input[name="name"]', BRAND);
await admin.click('form button:has-text("Enregistrer")');
await admin.waitForTimeout(1400);
check("brand created", !!(await prisma.brand.findFirst({ where: { name: BRAND } })));

console.log("\n[2] ADMIN ADDS A BRAND-NEW PRODUCT");
await admin.goto(`${BASE}/admin/stock/nouveau`);
await admin.waitForTimeout(800);
await admin.fill('input[name="sku"]', SKU);
await admin.fill('input[name="name"]', PRODUCT);
await admin.selectOption('select[name="categoryId"]', { label: `${FAM} › ${SUB}` });
await admin.selectOption('select[name="brandId"]', { label: BRAND });
await admin.fill('textarea[name="description"]', "Amortisseur avant, test de bout en bout.");
await admin.fill('input[name="priceBuy"]', "80");
await admin.fill('input[name="priceSell"]', "149.90");
await admin.fill('input[name="compareAtPrice"]', "199");
await admin.fill('input[name="stockQty"]', "7");
await admin.click('button:has-text("Enregistrer")');
await admin.waitForTimeout(2000);

const created = await prisma.product.findUnique({
  where: { sku: SKU },
  select: { id: true, slug: true, name: true, priceSell: true, stockQty: true, active: true, categoryId: true, brandId: true },
});
check("product stored in the database", !!created, created?.slug);
check("price stored exactly", Number(created?.priceSell) === 149.9, String(created?.priceSell));
check("stock stored", created?.stockQty === 7);
check("filed under the new subcategory", created?.categoryId === subCat?.id);
check("active by default so shoppers can see it", created?.active === true);

console.log("\n[3] ADMIN PHOTOGRAPHS IT");
await admin.goto(`${BASE}/admin/stock/${created.id}`);
await admin.waitForTimeout(900);
await admin.setInputFiles('input[type="file"]', [`${PICS}/pad-front.png`, `${PICS}/pad-side.png`]);
await admin.waitForTimeout(2500);
const shots = await prisma.productImage.findMany({ where: { productId: created.id }, orderBy: { order: "asc" }, select: { id: true } });
check("photos attached", shots.length === 2, `${shots.length}`);

console.log("\n[4] A NEW CUSTOMER REGISTERS");
const shopCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const shop = await shopCtx.newPage();
shop.on("pageerror", (e) => console.log("  SHOP JS ERROR:", e.message));
await shop.goto(`${BASE}/compte`);
await shop.waitForTimeout(600);
await shop.click('button:has-text("Créer un compte")');
await shop.waitForTimeout(500);
await shop.fill('input[name="name"]', "Client AZ");
await shop.fill('input[name="email"]', EMAIL);
await shop.fill('input[name="phone"]', "20999888");
await shop.fill('input[name="password"]', PASSWORD);
await shop.getByRole("button", { name: /Créer mon compte|Créer un compte/ }).last().click();
await shop.waitForTimeout(2500);
const account = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, name: true, passwordHash: true } });
check("account stored in the database", !!account, account?.name);
check("password is hashed, never stored raw", !!account && account.passwordHash !== PASSWORD && account.passwordHash.length > 20);

console.log("\n[5] THE CUSTOMER FINDS THE NEW PRODUCT");
await shop.goto(`${BASE}/recherche?q=${encodeURIComponent(`AZ ${STAMP}`)}`);
await shop.waitForTimeout(900);
check("findable by name search", (await shop.locator(`text=${PRODUCT}`).count()) > 0);

await shop.goto(`${BASE}/recherche?q=${encodeURIComponent(SKU)}`);
await shop.waitForTimeout(900);
check("findable by its reference (SKU)", (await shop.locator(`text=${PRODUCT}`).count()) > 0);

await shop.goto(`${BASE}/catalogue/${FAM_SLUG}/${SUB_SLUG}`);
await shop.waitForTimeout(900);
check("listed in its catalogue page", (await shop.locator(`text=${PRODUCT}`).count()) > 0);
const listImgs = await shop.locator("main img").evaluateAll((e) => e.map((i) => decodeURIComponent(i.getAttribute("src") || "")));
check("its card shows the uploaded photo", listImgs.some((s) => s.includes(`/api/images/${shots[0].id}`)));

await shop.goto(`${BASE}/produit/${created.slug}`);
await shop.waitForTimeout(900);
const body = await shop.locator("main").innerText();
check("product page shows the price we set", body.includes("149.90"), body.match(/\d+\.\d\d DT/)?.[0]);
check("product page shows the struck-through price", body.includes("199.00"));
check("product page shows stock", /En stock/i.test(body));

console.log("\n[6] BUY IT");
await shop.locator('button:has-text("Ajouter au panier")').first().click();
await shop.waitForTimeout(800);
await shop.goto(`${BASE}/commande`);
await shop.waitForTimeout(900);
const prefilled = await shop.inputValue('input[placeholder="Nom complet"]').catch(() => "");
check("checkout pre-fills the logged-in customer's name", prefilled.length > 0, prefilled || "(empty)");
if (!prefilled) await shop.fill('input[placeholder="Nom complet"]', "Client AZ");
if (!(await shop.inputValue('input[type="tel"]'))) await shop.fill('input[type="tel"]', "20999888");
await shop.locator('button:has-text("Tunis")').first().click();
await shop.fill('input[placeholder="Adresse"]', "3 Rue AZ, Tunis");
await shop.locator('button[type="submit"]:has-text("Confirmer la commande")').click();
await shop.waitForURL(/\/commande\/confirmation\//, { timeout: 20000 }).catch(() => {});
const ref = shop.url().split("/").pop();
check("order placed", /^CMD-/.test(ref || ""), ref);

const order = await prisma.order.findUnique({
  where: { ref },
  select: { id: true, userId: true, total: true, status: true, items: { select: { name: true, qty: true, unitPrice: true, imageUrl: true } } },
});
check("order linked to the customer's account", order?.userId === account?.id);
check("order line has the right product and price", order?.items[0]?.name === PRODUCT && Number(order.items[0].unitPrice) === 149.9);
check("stock decremented 7 -> 6", (await prisma.product.findUnique({ where: { id: created.id }, select: { stockQty: true } })).stockQty === 6);

console.log("\n[7] THE CUSTOMER TRACKS IT IN THEIR ACCOUNT");
await shop.goto(`${BASE}/compte/commandes`);
await shop.waitForTimeout(1000);
const orders = await shop.locator("main").innerText();
check("the order is listed in Mes commandes", orders.includes(ref), ref);
check("with the product name", orders.includes(PRODUCT));

console.log("\n[8] ADMIN ADVANCES IT, CUSTOMER SEES IT");
await admin.goto(`${BASE}/admin/commandes/${order.id}`);
await admin.waitForTimeout(900);
await admin.click('button:has-text("Confirmée")');
await admin.waitForTimeout(1500);
check("status stored", (await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } })).status === "CONFIRMED");
await shop.goto(`${BASE}/compte/commandes`);
await shop.waitForTimeout(900);
check("customer sees the new status", (await shop.locator("main").innerText()).includes("Confirmée"));

console.log("\n[9] DEACTIVATING HIDES IT FROM THE SHOP");
await admin.goto(`${BASE}/admin/stock/${created.id}`);
await admin.waitForTimeout(900);
await admin.uncheck('input[type="checkbox"][name="active"]');
await admin.click('button:has-text("Enregistrer")');
await admin.waitForTimeout(2000);
await shop.goto(`${BASE}/catalogue/${FAM_SLUG}/${SUB_SLUG}`);
await shop.waitForTimeout(900);
check("an inactive product leaves the catalogue", (await shop.locator(`text=${PRODUCT}`).count()) === 0);

await cleanup();
await browser.close();
await sweepTestDemand();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
