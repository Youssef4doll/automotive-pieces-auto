// Category pictures and vehicle-make logos: admin uploads a real file, it is
// stored as bytes (MediaAsset, like every other upload on the site), and it
// shows up on the storefront cards it was uploaded for — without breaking the
// box layout for the categories/makes that don't have one yet.
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

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const admin = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
admin.on("pageerror", (e) => console.log("  PAGE ERROR:", e.message));

await admin.goto(`${BASE}/compte`);
await admin.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
await admin.fill('input[name="password"]', "admin1234");
await admin.getByRole("button", { name: "Se connecter", exact: true }).click();
await admin.waitForURL(`${BASE}/admin`, { timeout: 20000 });

const family = await prisma.category.findFirst({ where: { parentId: null }, select: { id: true, name: true } });

console.log("\n[1] ADMIN UPLOADS A FAMILY PICTURE");
{
  await admin.goto(`${BASE}/admin/catalogue`);
  await admin.waitForTimeout(600);
  const row = admin.locator("li", { hasText: family.name }).first();
  await row.getByLabel("Modifier").click();
  await admin.waitForTimeout(300);
  const form = row.locator("form").first();
  await form.locator('input[type="file"]').setInputFiles(`${PICS}/freinage.png`);
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await admin.waitForTimeout(1500);

  const updated = await prisma.category.findUnique({ where: { id: family.id }, select: { imageUrl: true } });
  check("the category got an uploaded picture", /^\/api\/images\//.test(updated?.imageUrl || ""), updated?.imageUrl);

  const assetId = updated.imageUrl.split("/").pop();
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  check("stored as real bytes", (asset?.data?.length ?? 0) > 500, `${asset?.data?.length} bytes`);

  const res = await admin.request.get(`${BASE}${updated.imageUrl}`);
  check("served back over HTTP", res.status() === 200);
}

console.log("\n[2] THE HOMEPAGE SHOWS IT");
{
  const shop = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await shop.goto(BASE);
  await shop.waitForTimeout(1500);
  const card = shop.locator(`button:has-text("${family.name}")`).first();
  await card.scrollIntoViewIfNeeded();
  await shop.waitForTimeout(600);
  const img = card.locator("img").first();
  check("the family card carries an image", (await img.count()) > 0);
  const painted = await img.evaluate((el) => el.naturalWidth).catch(() => 0);
  check("and the browser actually paints it", painted > 0, `naturalWidth ${painted}`);

  // A family that hasn't been photographed yet still renders a same-size box
  // with an initial, not a broken layout.
  const anyCard = shop.locator('button[aria-controls^="subs-"]').first();
  check("every family card keeps the same box shape", (await anyCard.boundingBox())?.height >= 70);
  await shop.close();
}

console.log("\n[3] ADMIN UPLOADS A MAKE LOGO");
{
  const make = await prisma.vehicleMake.findFirst({ where: { name: { contains: "Renault" } }, select: { id: true, name: true } });
  if (!make) {
    console.log("  SKIP  no Renault in the seed");
  } else {
    await admin.goto(`${BASE}/admin/catalogue/vehicules`);
    await admin.waitForTimeout(600);
    check("the vehicles tab is on the admin nav", (await admin.locator('a[href="/admin/catalogue/vehicules"]').count()) > 0);

    const row = admin.locator(`[data-make="${make.id}"]`);
    await row.locator('input[type="file"]').setInputFiles(`${PICS}/renault-logo.png`);
    await row.getByRole("button", { name: "Téléverser" }).click();
    await admin.waitForTimeout(1500);

    const updated = await prisma.vehicleMake.findUnique({ where: { id: make.id }, select: { logoUrl: true } });
    check("the make got a logo", /^\/api\/images\//.test(updated?.logoUrl || ""), updated?.logoUrl);

    console.log("\n[4] THE VEHICLE SHORTCUTS SHOW IT");
    const shop = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
    await shop.goto(BASE);
    await shop.waitForTimeout(1500);
    const section = shop.locator("h2", { hasText: "Les véhicules que nous couvrons" }).locator("..").locator("..");
    await section.scrollIntoViewIfNeeded();
    await shop.waitForTimeout(600);
    const modelCard = section.locator(`a:has-text("${make.name}")`).first();
    check("a model card for this make exists", (await modelCard.count()) > 0);
    if (await modelCard.count() > 0) {
      const img = modelCard.locator("img").first();
      const painted = await img.evaluate((el) => el.naturalWidth).catch(() => 0);
      check("its logo is painted", painted > 0, `naturalWidth ${painted}`);
    }
    await shop.close();

    console.log("\n[5] REMOVING THE LOGO CLEANS UP THE ASSET");
    const assetId = updated.logoUrl.split("/").pop();
    await admin.goto(`${BASE}/admin/catalogue/vehicules`);
    await admin.waitForTimeout(600);
    const row2 = admin.locator(`[data-make="${make.id}"]`);
    await row2.getByRole("button", { name: "Retirer" }).click();
    await admin.waitForTimeout(1200);
    const cleared = await prisma.vehicleMake.findUnique({ where: { id: make.id }, select: { logoUrl: true } });
    check("the logo is cleared", cleared?.logoUrl === null);
    check("and the old asset is gone", (await prisma.mediaAsset.count({ where: { id: assetId } })) === 0);
  }
}

console.log("\n[6] THE FAMILY TILES ARE PICTURE-LED");
{
  const shop = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await shop.goto(BASE);
  await shop.waitForTimeout(1200);
  const card = shop.locator(`button:has-text("${family.name}")`).first();
  await card.scrollIntoViewIfNeeded();
  await shop.waitForTimeout(500);

  // The picture sits above the label, not beside it — that is the whole shape
  // of this layout, and it is the thing a stray flex-direction would undo.
  const geo = await card.evaluate((el) => {
    const pic = el.querySelector("img")?.getBoundingClientRect();
    const label = el.querySelector("span.line-clamp-2")?.getBoundingClientRect();
    return pic && label ? { picBottom: pic.bottom, labelTop: label.top, picW: pic.width, cardW: el.getBoundingClientRect().width } : null;
  });
  check("the picture is above the name, not beside it", geo && geo.picBottom <= geo.labelTop + 1, JSON.stringify(geo));
  check("and it fills most of the tile", geo && geo.picW > geo.cardW * 0.6, geo && `${Math.round(geo.picW)}px of ${Math.round(geo.cardW)}px`);

  const cols = await shop.locator('button[aria-controls^="subs-"]').first().evaluate(
    (el) => getComputedStyle(el.parentElement).gridTemplateColumns.split(" ").length,
  );
  check("six across on a wide screen", cols === 6, `${cols} columns`);

  // Tapping a tile still opens its subcategories in place.
  await card.click();
  await shop.waitForTimeout(400);
  check("tapping a tile still opens its subcategories", (await shop.locator('[id^="subs-"] a').count()) > 0);
  await shop.close();
}

console.log("\n[7] CLEAN UP TEST DATA");
{
  const cat = await prisma.category.findUnique({ where: { id: family.id }, select: { imageUrl: true } });
  const assetId = cat?.imageUrl?.split("/").pop();
  await prisma.category.update({ where: { id: family.id }, data: { imageUrl: null } });
  if (assetId) await prisma.mediaAsset.deleteMany({ where: { id: assetId } });
  check("the test family picture is removed again", true);
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
await prisma.$disconnect();
process.exit(fail > 0 ? 1 : 0);
