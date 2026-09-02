// Proves product photography is real data, not a static asset: an admin
// uploads a file, it is stored as bytes in Postgres, served by /api/images,
// and shown to shoppers on the card, the product page and the cart.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { waitForAdmin } from "./lib/wait-for-admin.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PICS = process.env.PICS_DIR;
const prisma = new PrismaClient();

let pass = 0, fail = 0;
let photoOrder = null;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const target = await prisma.product.findFirst({
  where: { active: true, stockQty: { gt: 0 }, sku: { not: { startsWith: "PACK-" } } },
  select: { id: true, slug: true, name: true, categoryId: true },
});
await prisma.productImage.deleteMany({ where: { productId: target.id } });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("  PAGE ERROR:", e.message));

await page.goto(`${BASE}/compte`);
await page.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
await page.fill('input[name="password"]', "admin1234");
await page.getByRole("button", { name: "Se connecter", exact: true }).click();
await waitForAdmin(page, BASE);

console.log("\n[1] BEFORE: THE PRODUCT USES THE SHARED STATIC IMAGE");
{
  const shop = await (await browser.newContext()).newPage();
  await shop.goto(`${BASE}/produit/${target.slug}`);
  await shop.waitForTimeout(600);
  const src = await shop.locator("main img").first().getAttribute("src");
  check("product page falls back to the generic catalogue picture", /parts-lineup/.test(decodeURIComponent(src || "")), src?.slice(0, 60));
  await shop.close();
}

console.log("\n[2] ADMIN UPLOADS TWO REAL PHOTOS");
await page.goto(`${BASE}/admin/stock/${target.id}`);
await page.waitForTimeout(900);
await page.setInputFiles('input[type="file"]', [`${PICS}/pad-front.png`, `${PICS}/pad-side.png`]);
await page.waitForTimeout(2500);

const stored = await prisma.productImage.findMany({
  where: { productId: target.id },
  orderBy: { order: "asc" },
  select: { id: true, mimeType: true, order: true, data: true },
});
check("two photos stored in the database", stored.length === 2, `${stored.length} rows`);
check("stored as real bytes, not a path", stored[0]?.data?.length > 10000, `${stored[0]?.data?.length} bytes`);
check("mime type detected from the file itself", stored[0]?.mimeType === "image/png", stored[0]?.mimeType);
check("ordered, first is primary", stored[0]?.order === 0 && stored[1]?.order === 1);

console.log("\n[3] THE BYTES ARE SERVED BACK OVER HTTP");
{
  const res = await page.request.get(`${BASE}/api/images/${stored[0].id}`);
  const body = await res.body();
  check("/api/images returns 200", res.status() === 200);
  check("with the right content type", res.headers()["content-type"] === "image/png", res.headers()["content-type"]);
  check("bytes match what was stored", body.length === stored[0].data.length, `${body.length} vs ${stored[0].data.length}`);
  check("cached hard (ids are immutable)", /immutable/.test(res.headers()["cache-control"] || ""));
  // A deleted photo still referenced by an old order must not break: the route
  // falls back to the generic part picture instead of a broken thumbnail.
  const missing = await page.request.get(`${BASE}/api/images/does-not-exist`, { maxRedirects: 0 });
  check("a deleted/unknown photo falls back instead of breaking",
        missing.status() === 302 && (missing.headers()["location"] || "").includes("parts-lineup"),
        `status=${missing.status()} -> ${missing.headers()["location"]}`);
}

console.log("\n[4] SHOPPERS SEE THE UPLOADED PHOTO EVERYWHERE");
{
  const shop = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

  await shop.goto(`${BASE}/produit/${target.slug}`);
  await shop.waitForTimeout(800);
  const main = await shop.locator("main img").first().getAttribute("src");
  check("product page shows the uploaded photo", decodeURIComponent(main || "").includes(`/api/images/${stored[0].id}`), main?.slice(0, 70));

  // The src being right is not the same as the photo appearing: next/image
  // routes it through the optimiser, which once rejected /api/images and left
  // a broken-image icon behind a perfectly correct src.
  const hero = shop.locator("main img").first();
  await hero.scrollIntoViewIfNeeded();
  await shop.waitForTimeout(1500);
  const painted = await hero.evaluate((el) => el.naturalWidth);
  check("and the browser actually paints it", painted > 0, `naturalWidth ${painted}`);

  const thumbs = await shop.locator('button[aria-label^="Photo"]').count();
  check("a gallery strip appears for the second photo", thumbs === 2, `${thumbs} thumbnails`);

  // The second thumbnail must actually swap the main image.
  await shop.locator('button[aria-label^="Photo 2"]').click();
  await shop.waitForTimeout(500);
  const swapped = await shop.locator("main img").first().getAttribute("src");
  check("tapping a thumbnail changes the main photo",
        decodeURIComponent(swapped || "").includes(`/api/images/${stored[1].id}`), swapped?.slice(0, 70));

  // And the listing card, which is a different query path.
  const cat = await prisma.category.findUnique({ where: { id: target.categoryId }, select: { slug: true, parent: { select: { slug: true } } } });
  const url = cat.parent ? `/catalogue/${cat.parent.slug}/${cat.slug}` : `/catalogue/${cat.slug}`;
  await shop.goto(BASE + url);
  await shop.waitForTimeout(900);
  const cardImgs = await shop.locator("main img").evaluateAll((els) => els.map((e) => decodeURIComponent(e.getAttribute("src") || "")));
  check("the catalogue card shows it too", cardImgs.some((s) => s.includes(`/api/images/${stored[0].id}`)),
        `${cardImgs.filter((s) => s.includes("/api/images/")).length} card(s) on real photos`);

  // Search is yet another query path.
  await shop.goto(`${BASE}/recherche?q=${encodeURIComponent(target.name.split(" ")[0])}`);
  await shop.waitForTimeout(800);
  const searchImgs = await shop.locator("main img").evaluateAll((els) => els.map((e) => decodeURIComponent(e.getAttribute("src") || "")));
  check("search results show it", searchImgs.some((s) => s.includes("/api/images/")));
  await shop.close();
}

console.log("\n[5] AN ORDER SNAPSHOTS THE PHOTO THE SHOPPER SAW");
{
  const shop = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await shop.goto(`${BASE}/produit/${target.slug}`);
  await shop.waitForTimeout(800);
  await shop.locator('button:has-text("Ajouter au panier")').first().click();
  await shop.waitForTimeout(700);
  await shop.goto(`${BASE}/commande`);
  await shop.waitForTimeout(900);
  await shop.fill('input[placeholder="Nom complet"]', "QA Photo");
  await shop.fill('input[type="tel"]', "20111222");
  await shop.locator('button:has-text("Tunis")').first().click();
  await shop.fill('input[placeholder="Adresse"]', "1 Rue Photo");
  await shop.locator('button[type="submit"]:has-text("Confirmer la commande")').click();
  await shop.waitForURL(/\/commande\/confirmation\//, { timeout: 20000 }).catch(() => {});
  const ref = shop.url().split("/").pop();
  const item = await prisma.orderItem.findFirst({
    where: { order: { ref } },
    select: { imageUrl: true, orderId: true },
  });
  check("the order line records the real photo, not the placeholder",
        !!item && item.imageUrl.startsWith("/api/images/"), item?.imageUrl);
  photoOrder = { ref, orderId: item?.orderId };
  await shop.close();
}

console.log("\n[6] ADMIN LIST SHOWS THUMBNAILS");
await page.goto(`${BASE}/admin/stock`);
await page.waitForTimeout(1000);
const rowImgs = await page.locator("tbody img").evaluateAll((els) => els.map((e) => decodeURIComponent(e.getAttribute("src") || "")));
check("stock rows render a thumbnail", rowImgs.length > 0, `${rowImgs.length} thumbnails`);
check("the edited product's row uses its real photo", rowImgs.some((s) => s.includes(`/api/images/${stored[0].id}`)));
check("products without a photo are flagged", (await page.locator("text=sans photo").count()) > 0);

console.log("\n[7] SET A DIFFERENT PRIMARY PHOTO");
await page.goto(`${BASE}/admin/stock/${target.id}`);
await page.waitForTimeout(900);
await page.locator('button:has-text("Principale")').last().click();
await page.waitForTimeout(2000);
const after = await prisma.productImage.findMany({ where: { productId: target.id }, orderBy: { order: "asc" }, select: { id: true } });
check("the promoted photo is now first", after[0].id === stored[1].id, `${after[0].id === stored[1].id ? "swapped" : "unchanged"}`);
{
  const shop = await (await browser.newContext()).newPage();
  await shop.goto(`${BASE}/produit/${target.slug}`);
  await shop.waitForTimeout(700);
  const src = await shop.locator("main img").first().getAttribute("src");
  check("the shop leads with the new primary", decodeURIComponent(src || "").includes(`/api/images/${stored[1].id}`));
  await shop.close();
}

console.log("\n[8] JUNK FILES ARE REFUSED");
await page.setInputFiles('input[type="file"]', [`${PICS}/notanimage.txt`]);
await page.waitForTimeout(2000);
check("a non-image is rejected with a message", (await page.locator("text=/n'est pas une image/").count()) > 0);
check("and nothing extra was stored", (await prisma.productImage.count({ where: { productId: target.id } })) === 2);

console.log("\n[9] DELETING A PHOTO");
await page.goto(`${BASE}/admin/stock/${target.id}`);
await page.waitForTimeout(900);
await page.locator('button[aria-label="Supprimer la photo"]').first().click();
await page.waitForTimeout(2000);
check("photo removed from the database", (await prisma.productImage.count({ where: { productId: target.id } })) === 1);

// Deleting the product must take its photos with it rather than orphaning bytes.
const probe = await prisma.product.create({
  data: { sku: "QA-IMG-CASCADE", name: "QA cascade", slug: "qa-img-cascade", categoryId: target.categoryId, priceSell: 1 },
});
await prisma.productImage.create({ data: { productId: probe.id, data: Buffer.from([1, 2, 3]), mimeType: "image/png" } });
await prisma.product.delete({ where: { id: probe.id } });
check("deleting a product cascades to its photos", (await prisma.productImage.count({ where: { productId: probe.id } })) === 0);

if (photoOrder?.orderId) {
  await prisma.orderItem.deleteMany({ where: { orderId: photoOrder.orderId } });
  await prisma.orderStatusEvent.deleteMany({ where: { orderId: photoOrder.orderId } });
  await prisma.order.delete({ where: { id: photoOrder.orderId } });
}
await prisma.productImage.deleteMany({ where: { productId: target.id } });
await browser.close();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
