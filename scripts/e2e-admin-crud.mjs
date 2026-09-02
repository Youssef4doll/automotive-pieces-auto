// The admin's own tools: stock organised by family and arrival, photos on the
// add form, a slug that follows the name without breaking old links, the
// vehicle tree as real CRUD, which cars a part fits, and a customer record the
// shop can correct without rewriting what already happened.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { waitForAdmin } from "./lib/wait-for-admin.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PICS = process.env.PICS_DIR;
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const STAMP = Date.now().toString().slice(-6);
const SKU = `QA-CRUD-${STAMP}`;
const MAKE = `QaMarque${STAMP}`;

async function cleanup() {
  const p = await prisma.product.findUnique({ where: { sku: SKU }, select: { id: true } });
  if (p) {
    await prisma.productFitment.deleteMany({ where: { productId: p.id } });
    await prisma.productImage.deleteMany({ where: { productId: p.id } });
    await prisma.partReference.deleteMany({ where: { productId: p.id } });
    await prisma.productSlugHistory.deleteMany({ where: { productId: p.id } });
    await prisma.product.delete({ where: { id: p.id } });
  }
  await prisma.vehicleMake.deleteMany({ where: { name: { startsWith: "QaMarque" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "qa-crud-" } } });
}
await cleanup();

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
p.on("pageerror", (e) => console.log("  PAGE ERROR:", e.message));

await p.goto(`${BASE}/compte`);
await p.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
await p.fill('input[name="password"]', "admin1234");
await p.getByRole("button", { name: "Se connecter", exact: true }).click();
await waitForAdmin(p, BASE);

try {
  console.log("\n[1] STOCK IS ORGANISED, NOT JUST LISTED");
  {
    await p.goto(`${BASE}/admin/stock`);
    await p.waitForTimeout(1200);
    const body = await p.locator("main").innerText();

    check("products are grouped under their family", (await p.locator("main section h2").count()) > 1,
          `${await p.locator("main section h2").count()} families`);
    check("each family reports what it holds", /référence\(s\)/.test(body));
    check("and what that stock is worth", /Valeur du stock/.test(body));
    check("every row carries the date it was added", (await p.locator('main th:has-text("Ajouté")').count()) > 0);

    // Sorting and filtering are addressable, so a view can be shared or bookmarked.
    await p.goto(`${BASE}/admin/stock?tri=recent`);
    await p.waitForTimeout(900);
    const dates = await p.locator("main tbody tr td:nth-child(3)").allInnerTexts();
    check("sorting by arrival is a real view", dates.length > 0, `${dates.length} rows`);

    await p.goto(`${BASE}/admin/stock?f=sansphoto`);
    await p.waitForTimeout(900);
    const noPhoto = await p.locator("main").innerText();
    check("the 'sans photo' filter narrows the list",
          !noPhoto.includes("Aucun produit ne correspond") ? /sans photo/.test(noPhoto) : true);
  }

  console.log("\n[2] A NEW PRODUCT TAKES ITS PHOTOS ON THE WAY IN");
  {
    const cat = await prisma.category.findFirst({ where: { parentId: { not: null } }, select: { id: true } });
    await p.goto(`${BASE}/admin/stock/nouveau`);
    await p.waitForTimeout(900);
    check("the add form offers a photo field", (await p.locator('input[name="photos"]').count()) === 1);

    await p.fill('input[name="sku"]', SKU);
    await p.fill('input[name="name"]', `Plaquette QA ${STAMP}`);
    await p.selectOption('select[name="categoryId"]', cat.id);
    await p.fill('input[name="priceBuy"]', "20");
    await p.fill('input[name="priceSell"]', "35");
    await p.fill('input[name="stockQty"]', "7");
    await p.locator('input[name="photos"]').setInputFiles([`${PICS}/pad-front.png`, `${PICS}/pad-side.png`]);
    await p.getByRole("button", { name: "Enregistrer" }).click();
    await p.waitForTimeout(2500);

    const created = await prisma.product.findUnique({
      where: { sku: SKU },
      select: { id: true, slug: true, name: true, images: true },
    });
    check("the product is created", !!created, created?.slug);
    check("with its photos already attached", (created?.images.length ?? 0) === 2,
          `${created?.images.length} photo(s)`);
    check("stored as real bytes", (created?.images[0]?.data?.length ?? 0) > 500);
    check("the slug is derived from the name and reference",
          created?.slug.includes("plaquette-qa") && created?.slug.includes(STAMP.toLowerCase()), created?.slug);
  }

  console.log("\n[3] A REJECTED SAVE KEEPS WHAT WAS TYPED");
  {
    await p.goto(`${BASE}/admin/stock/nouveau`);
    await p.waitForTimeout(900);
    const longDescription = `Description QA ${STAMP} qui ne doit pas disparaître`;
    await p.fill('input[name="sku"]', `${SKU}-BIS`);
    await p.fill('input[name="name"]', "X"); // too short — the server refuses
    await p.fill('textarea[name="description"]', longDescription);
    await p.fill('textarea[name="oemRefsText"]', "7701234567, 8200123456");
    await p.fill('input[name="priceBuy"]', "11");
    await p.fill('input[name="priceSell"]', "22");
    await p.getByRole("button", { name: "Enregistrer" }).click();
    await p.waitForTimeout(2000);

    check("the refusal is explained", /alert/.test(await p.locator('[role="alert"]').count() > 0 ? "alert" : ""),
          (await p.locator('[role="alert"]').innerText().catch(() => "")).slice(0, 60));
    check("the description survives", (await p.locator('textarea[name="description"]').inputValue()) === longDescription);
    check("so do the references", (await p.locator('textarea[name="oemRefsText"]').inputValue()).includes("7701234567"));
    check("and the prices", (await p.locator('input[name="priceSell"]').inputValue()) === "22");
    check("the reference is still there too", (await p.locator('input[name="sku"]').inputValue()) === `${SKU}-BIS`);
    check("nothing was written", (await prisma.product.count({ where: { sku: `${SKU}-BIS` } })) === 0);
  }

  console.log("\n[4] RENAMING A PART MOVES ITS ADDRESS AND KEEPS THE OLD ONE ALIVE");
  {
    const before = await prisma.product.findUnique({ where: { sku: SKU }, select: { id: true, slug: true } });
    await p.goto(`${BASE}/admin/stock/${before.id}`);
    await p.waitForTimeout(1200);
    await p.fill('input[name="name"]', `Plaquette QA renommee ${STAMP}`);
    await p.getByRole("button", { name: "Enregistrer" }).click();
    await p.waitForTimeout(2500);

    const after = await prisma.product.findUnique({ where: { sku: SKU }, select: { slug: true } });
    check("the slug follows the new name", after.slug !== before.slug && after.slug.includes("renommee"),
          `${before.slug} → ${after.slug}`);

    const kept = await prisma.productSlugHistory.findUnique({ where: { slug: before.slug } });
    check("the old address is remembered", !!kept);

    const res = await p.request.get(`${BASE}/produit/${before.slug}`, { maxRedirects: 0 });
    check("and it redirects permanently rather than 404ing", res.status() === 308 || res.status() === 301,
          `status ${res.status()}`);
    const target = res.headers()["location"] ?? "";
    check("straight to the part's new address", target.includes(after.slug), target);

    const live = await p.request.get(`${BASE}/produit/${after.slug}`);
    check("the new address serves the page", live.status() === 200);
  }

  console.log("\n[5] THE VEHICLE TREE IS EDITABLE");
  {
    await p.goto(`${BASE}/admin/catalogue/vehicules`);
    await p.waitForTimeout(1200);

    // Make
    await p.locator('form:has-text("Nouvelle marque") input[name="name"]').fill(MAKE);
    await p.locator('form:has-text("Nouvelle marque") button:has-text("Ajouter")').click();
    await p.waitForTimeout(2000);
    const make = await prisma.vehicleMake.findFirst({ where: { name: MAKE } });
    check("an admin can add a make", !!make, make?.slug);
    check("its address is derived, not typed", make?.slug === MAKE.toLowerCase());

    // Model
    const row = p.locator(`[data-make="${make.id}"]`);
    await row.getByRole("button", { name: "Modèles" }).click();
    await p.waitForTimeout(600);
    await row.locator('form:has-text("Nouveau modèle") input[name="name"]').fill("Modele QA");
    await row.locator('form:has-text("Nouveau modèle") input[name="yearFrom"]').fill("2015");
    await row.locator('form:has-text("Nouveau modèle") input[name="yearTo"]').fill("2021");
    await row.locator('form:has-text("Nouveau modèle") button:has-text("Ajouter")').click();
    await p.waitForTimeout(2000);
    const model = await prisma.vehicleModel.findFirst({ where: { makeId: make.id } });
    check("and a model under it", !!model, model?.slug);
    check("with the years it was sold", model?.yearFrom === 2015 && model?.yearTo === 2021);

    // Bad years are refused rather than stored
    await p.reload();
    await p.waitForTimeout(1200);
    const row2 = p.locator(`[data-make="${make.id}"]`);
    await row2.getByRole("button", { name: "Modèles" }).click();
    await p.waitForTimeout(600);
    await row2.locator('form:has-text("Nouveau modèle") input[name="name"]').fill("Modele Impossible");
    await row2.locator('form:has-text("Nouveau modèle") input[name="yearFrom"]').fill("2020");
    await row2.locator('form:has-text("Nouveau modèle") input[name="yearTo"]').fill("2010");
    await row2.locator('form:has-text("Nouveau modèle") button:has-text("Ajouter")').click();
    await p.waitForTimeout(1800);
    check("years that run backwards are refused",
          (await prisma.vehicleModel.count({ where: { name: "Modele Impossible" } })) === 0);

    // Engine
    const modelRow = p.locator(`[data-model="${model.id}"]`);
    await modelRow.getByRole("button", { name: "Motorisations" }).click();
    await p.waitForTimeout(600);
    await modelRow.locator('form:has-text("Motorisation") input[name="name"]').first().fill("1.5 QA");
    await modelRow.locator('form input[name="engineCode"]').first().fill("QA9K");
    await modelRow.locator('form button:has-text("Ajouter")').first().click();
    await p.waitForTimeout(2000);
    const engine = await prisma.vehicleEngine.findFirst({ where: { modelId: model.id } });
    check("and a motorisation under that", !!engine, engine?.name);
    check("with the engine code supplier data is keyed on", engine?.engineCode === "QA9K");
  }

  console.log("\n[6] WHICH CARS A PART FITS");
  {
    const product = await prisma.product.findUnique({ where: { sku: SKU }, select: { id: true, slug: true } });
    const engine = await prisma.vehicleEngine.findFirst({ where: { model: { make: { name: MAKE } } } });

    await p.goto(`${BASE}/admin/stock/${product.id}`);
    await p.waitForTimeout(1500);
    const panel = p.locator('section[aria-labelledby="fitments"]');
    check("the product page carries a compatibility panel", (await panel.count()) === 1);
    check("an empty list is stated as unknown, not incompatible",
          /non vérifiée/.test(await panel.innerText()));

    await panel.getByRole("button", { name: MAKE }).click();
    await p.waitForTimeout(500);
    await panel.locator('input[type="checkbox"]').first().check();
    await p.waitForTimeout(2000);

    const fits = await prisma.productFitment.count({ where: { productId: product.id, engineId: engine.id } });
    check("ticking a model attaches the part to its engines", fits === 1);
    const row = await prisma.productFitment.findFirst({ where: { productId: product.id } });
    check("recorded as verified, because a person said so", row?.confidence === "VERIFIED");

    await p.locator('input[type="checkbox"]').first().uncheck();
    await p.waitForTimeout(2000);
    check("and unticking removes it again",
          (await prisma.productFitment.count({ where: { productId: product.id } })) === 0);
  }

  console.log("\n[7] A MAKE CARRYING COMPATIBILITY IS NOT DELETED BY ACCIDENT");
  {
    const product = await prisma.product.findUnique({ where: { sku: SKU }, select: { id: true } });
    const engine = await prisma.vehicleEngine.findFirst({ where: { model: { make: { name: MAKE } } } });
    await prisma.productFitment.create({ data: { productId: product.id, engineId: engine.id } });

    const make = await prisma.vehicleMake.findFirst({ where: { name: MAKE } });
    await p.goto(`${BASE}/admin/catalogue/vehicules`);
    await p.waitForTimeout(1200);
    await p.locator(`[data-make="${make.id}"]`).getByRole("button", { name: "Supprimer" }).click();
    await p.waitForTimeout(2000);

    check("the delete is refused", (await prisma.vehicleMake.count({ where: { name: MAKE } })) === 1);
    check("and the reason is named", /compatibilité/i.test(await p.locator(`[data-make="${make.id}"]`).innerText()));

    // Clear the fitment; now it may go.
    await prisma.productFitment.deleteMany({ where: { productId: product.id } });
    await p.reload();
    await p.waitForTimeout(1200);
    await p.locator(`[data-make="${make.id}"]`).getByRole("button", { name: "Supprimer" }).click();
    await p.waitForTimeout(2000);
    check("once nothing depends on it, it goes", (await prisma.vehicleMake.count({ where: { name: MAKE } })) === 0);
  }

  console.log("\n[8] CORRECTING A CUSTOMER DOES NOT REWRITE THEIR ORDERS");
  {
    const email = `qa-crud-${STAMP}@example.test`;
    const user = await prisma.user.create({
      data: { email, name: "Ancien Nom", phone: "20111000", passwordHash: await bcrypt.hash("motdepasse1", 12), role: "CUSTOMER" },
    });
    const order = await prisma.order.create({
      data: {
        ref: `CMD-QA${STAMP}`,
        userId: user.id,
        customerName: "Ancien Nom",
        phone: "20111000",
        governorate: "Tunis",
        subtotal: 35,
        total: 35,
      },
    });

    await p.goto(`${BASE}/admin/clients/${user.id}`);
    await p.waitForTimeout(1200);
    const card = p.locator('section[aria-labelledby="fiche"]');
    check("the customer record is editable", (await card.getByRole("button", { name: "Modifier" }).count()) === 1);

    await card.getByRole("button", { name: "Modifier" }).click();
    await p.waitForTimeout(400);
    await card.locator('input[name="name"]').fill("Nouveau Nom");
    await card.getByRole("button", { name: "Enregistrer" }).click();
    await p.waitForTimeout(2200);

    const updated = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
    check("the account carries the corrected name", updated.name === "Nouveau Nom", updated.name);

    const kept = await prisma.order.findUnique({ where: { id: order.id }, select: { customerName: true } });
    check("the order keeps the name it was placed under", kept.customerName === "Ancien Nom", kept.customerName);

    const trail = await prisma.userProfileChange.findMany({ where: { userId: user.id } });
    check("the change is on the record", trail.length === 1, `${trail.length} entries`);
    check("with what it was and what it became",
          trail[0]?.oldValue === "Ancien Nom" && trail[0]?.newValue === "Nouveau Nom");
    check("and that the shop made it, not the customer", trail[0]?.changedBy === "ADMIN");

    await p.reload();
    await p.waitForTimeout(1400);
    const shown = await p.locator("main").innerText();
    check("the page shows the old name against the old order", shown.includes("au nom de Ancien Nom"));
    check("and lists the correction", /Ancien Nom[\s\S]{0,40}Nouveau Nom/.test(shown));

    // An account with orders cannot be deleted out from under its own sales.
    check("deleting it is refused while it has orders",
          /ne peut pas être supprimé/.test(shown));

    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.orderStatusEvent.deleteMany({ where: { orderId: order.id } });
    await prisma.cart.updateMany({ where: { orderId: order.id }, data: { orderId: null } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log("\n[9] THE EMPTY SEARCH IS WRITTEN, NOT DECORATED");
  {
    const shop = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    // No digits, and nothing shared with the QA product this suite just
    // created — `eefe${STAMP}` fuzzy-matched the part's own name and the page
    // returned results instead of the empty state being tested.
    await shop.goto(`${BASE}/recherche?q=eefeqzwx`);
    // The block is client-rendered, so wait for it rather than for a clock.
    await shop.getByText("Nous n'avons pas trouvé de correspondance exacte").waitFor({ timeout: 15000 });
    const block = await shop.locator("main").innerText();

    check("no emoji in the way out", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(block),
          (block.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []).join(" "));
    for (const label of ["Nous contacter", "Choisir ou changer de véhicule", "Chercher par référence", "Envoyer une photo"]) {
      check(`« ${label} » is offered`, block.includes(label));
    }
    check("the routes are drawn, not typed", (await shop.locator("main svg").count()) >= 4,
          `${await shop.locator("main svg").count()} icons`);
    await shop.close();
    await prisma.searchMiss.deleteMany({ where: { query: { contains: "eefeqzwx" } } });
  }
} finally {
  console.log("\n[10] CLEAN UP");
  await cleanup();
  check("test data removed", (await prisma.product.count({ where: { sku: { startsWith: "QA-CRUD-" } } })) === 0);
  await browser.close();
  await prisma.$disconnect();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
