// Proves the campaign band is the shop's to run, not ours to fake: an admin
// uploads artwork, it becomes bytes in Postgres served by /api/images, and it
// appears on the home page as a real carousel. Also holds the line on the
// invented content that used to sit in this part of the page — testimonials
// nobody wrote and an average rating nobody measured.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { waitForAdmin } from "./lib/wait-for-admin.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PICS = process.env.PICS_DIR;
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

// Start from a known state: no banners at all in the band.
//
// The home page now feeds hero slots and campaigns into one carousel, so
// "empty" means neither. The shop's own hero artwork is real content and is
// only parked for the run — deactivated here and switched back on at the end,
// never deleted.
await prisma.promotion.deleteMany({ where: { placement: "CAMPAIGN" } });
const parkedHeroes = await prisma.promotion.findMany({
  where: { placement: "HERO", active: true },
  select: { id: true },
});
if (parkedHeroes.length) {
  await prisma.promotion.updateMany({
    where: { id: { in: parkedHeroes.map((h) => h.id) } },
    data: { active: false },
  });
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const shopCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const shop = await shopCtx.newPage();
shop.on("pageerror", (e) => console.log("  PAGE ERROR (shop):", e.message));

const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const admin = await adminCtx.newPage();
admin.on("pageerror", (e) => console.log("  PAGE ERROR (admin):", e.message));

await admin.goto(`${BASE}/compte`);
await admin.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
await admin.fill('input[name="password"]', "admin1234");
await admin.getByRole("button", { name: "Se connecter", exact: true }).click();
await waitForAdmin(admin, BASE);

console.log("\n[1] NOTHING INVENTED WHERE THE OLD SECTIONS WERE");
{
  await shop.goto(BASE);
  await shop.waitForTimeout(700);
  const text = await shop.locator("body").innerText();

  check("no fabricated testimonials", !/Ils nous font confiance|Mehdi B\.|Salma T\.|Garage Ennasr/i.test(text));
  check("no average rating claimed with zero reviews", !/4[.,]8\s*\/\s*5/.test(text));
  check("the packs pitch is gone", !/Packs prêts à commander|Tout ce qu'il faut, en une fois/i.test(text));
  check(
    "an empty campaign band shows a shopper nothing at all",
    !/Aucune bannière de campagne/i.test(text),
  );
  check("the review table really is empty", (await prisma.review.count()) === 0);
}

console.log("\n[2] AN ADMIN IS TOLD WHERE THE EMPTY BAND IS");
{
  await admin.goto(BASE);
  await admin.waitForTimeout(700);
  const text = await admin.locator("body").innerText();
  check("admin sees the prompt a shopper does not", /Aucune bannière de campagne/i.test(text));
  const href = await admin.locator('a[href="/admin/promotions"]').first().getAttribute("href");
  check("and it links straight to the banner screen", href === "/admin/promotions");
}

console.log("\n[3] THE ADMIN UPLOADS REAL ARTWORK");
{
  await admin.goto(`${BASE}/admin/promotions`);
  await admin.waitForTimeout(800);
  const form = admin.locator('form:has(input[name="title"])').first();
  await form.locator('input[name="title"]').fill("Freinage : jusqu'à -25%");
  await form.locator('input[type="file"]').setInputFiles(`${PICS}/banner-freinage.png`);
  await form.locator('select[name="placement"]').selectOption("CAMPAIGN");
  await form.locator('select[name="kind"]').selectOption("SEASONAL");
  await form.locator('input[name="href"]').fill("/catalogue/freinage");
  await form.getByRole("button", { name: /Ajouter la bannière/i }).click();
  await admin.waitForTimeout(2500);

  const promo = await prisma.promotion.findFirst({ where: { placement: "CAMPAIGN" } });
  check("the banner is stored", !!promo, promo?.title);
  check("with the campaign kind chosen", promo?.kind === "SEASONAL", String(promo?.kind));
  check("and points at the uploaded asset", /^\/api\/images\//.test(promo?.imageUrl || ""), promo?.imageUrl);

  const assetId = promo?.imageUrl?.split("/").pop();
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  check("the picture is bytes in Postgres, not a path", (asset?.data?.length ?? 0) > 5000, `${asset?.data?.length} bytes`);
  check("mime sniffed from the file itself", asset?.mimeType === "image/png", asset?.mimeType);

  const res = await admin.request.get(`${BASE}${promo.imageUrl}`);
  check("served back over HTTP", res.status() === 200 && res.headers()["content-type"] === "image/png");
  check("cached hard (ids are immutable)", /immutable/.test(res.headers()["cache-control"] || ""));
}

console.log("\n[4] THE SHOPPER SEES IT, WITHOUT RELOADING THE PROJECT");
{
  await shop.goto(BASE);
  await shop.waitForTimeout(900);
  const band = shop.locator('section[aria-roledescription="carrousel"]');
  check("the campaign band is on the page", (await band.count()) === 1);
  const img = band.locator("img").first();
  check("showing the uploaded artwork", /\/api\/images\//.test(decodeURIComponent((await img.getAttribute("src")) || "")));
  check("with the title as alt text", (await img.getAttribute("alt")) === "Freinage : jusqu'à -25%");
  // Not just "the src is right": next/image rewrites it through the optimiser,
  // and the optimiser used to reject /api/images entirely — a correct src that
  // painted a broken-image icon. The band is lazy-loaded, so it has to be
  // scrolled to before the browser will even ask for the file.
  await band.scrollIntoViewIfNeeded();
  await shop.waitForTimeout(1500);
  const painted = await img.evaluate((el) => el.naturalWidth);
  check("and the browser actually paints it", painted > 0, `naturalWidth ${painted}`);
  const slideLabel = await band.locator('[aria-roledescription="diapositive"]').first().getAttribute("aria-label");
  check("the campaign type is announced, not painted on the artwork",
    /Campagne de saison/i.test(slideLabel || "") && !/Campagne de saison/i.test(await band.innerText()),
    slideLabel);
  check("linking where the admin pointed it", (await band.locator('a[href="/catalogue/freinage"]').count()) > 0);
  check("no arrows or dots for a single slide", (await band.getByRole("button").count()) === 0);
}

console.log("\n[5] A SECOND BANNER TURNS IT INTO A CAROUSEL");
{
  await admin.goto(`${BASE}/admin/promotions`);
  await admin.waitForTimeout(800);
  const form = admin.locator('form:has(input[name="title"])').first();
  await form.locator('input[name="title"]').fill("Prêt pour l'hiver");
  await form.locator('input[type="file"]').setInputFiles(`${PICS}/banner-hiver.png`);
  await form.locator('select[name="placement"]').selectOption("CAMPAIGN");
  await form.locator('select[name="kind"]').selectOption("DEAL");
  await form.locator('input[name="order"]').fill("1");
  await form.getByRole("button", { name: /Ajouter la bannière/i }).click();
  await admin.waitForTimeout(2500);
  check("two campaign banners now", (await prisma.promotion.count({ where: { placement: "CAMPAIGN" } })) === 2);

  await shop.goto(BASE);
  await shop.waitForTimeout(900);
  const band = shop.locator('section[aria-roledescription="carrousel"]');
  await band.scrollIntoViewIfNeeded();
  await shop.waitForTimeout(400);

  check("both slides are rendered", (await band.locator('[aria-roledescription="diapositive"]').count()) === 2);
  check("a next control exists", (await band.getByRole("button", { name: /Bannière suivante/i }).count()) === 1);
  check("dot indicators exist", (await band.getByRole("button", { name: /Aller à la bannière/i }).count()) === 2);

  const track = band.locator("div.overflow-x-auto").first();
  const before = await track.evaluate((el) => el.scrollLeft);
  await band.getByRole("button", { name: /Bannière suivante/i }).click();
  await shop.waitForTimeout(900);
  const after = await track.evaluate((el) => el.scrollLeft);
  check("the arrow actually advances the band", Math.abs(after) > Math.abs(before) + 100, `${before} → ${after}`);

  const current = await band.getByRole("button", { name: /Aller à la bannière 2/i }).getAttribute("aria-current");
  check("and the dot follows the slide", current === "true", String(current));

  // Off-screen slides must not be tabbable, or a keyboard user lands on
  // artwork they cannot see.
  const inert = await band.locator('[aria-roledescription="diapositive"]').first().evaluate((el) => el.hasAttribute("inert"));
  check("the slide scrolled out of view leaves the tab order", inert === true);

  await shop.screenshot({ path: `${PICS}/../shot-campaign-band.png`, clip: await band.boundingBox() });
}

console.log("\n[6] DEACTIVATING PULLS IT OFF THE STOREFRONT");
{
  const winter = await prisma.promotion.findFirst({ where: { title: "Prêt pour l'hiver" } });
  await admin.goto(`${BASE}/admin/promotions`);
  await admin.waitForTimeout(900);
  const card = admin.locator(`[data-promo="${winter.id}"]`);
  await card.getByRole("button", { name: "Active", exact: true }).click();
  await admin.waitForTimeout(1800);
  check("stored as inactive", (await prisma.promotion.findUnique({ where: { id: winter.id } }))?.active === false);

  await shop.goto(BASE);
  await shop.waitForTimeout(900);
  const band = shop.locator('section[aria-roledescription="carrousel"]');
  check("one slide left on the storefront", (await band.locator('[aria-roledescription="diapositive"]').count()) === 1);
}

console.log("\n[7] REPLACING THE ARTWORK DOES NOT LEAVE ORPHANS BEHIND");
{
  const before = await prisma.promotion.findFirst({ where: { title: "Freinage : jusqu'à -25%" } });
  const oldAssetId = before.imageUrl.split("/").pop();

  await admin.goto(`${BASE}/admin/promotions`);
  await admin.waitForTimeout(900);
  const card = admin.locator(`[data-promo="${before.id}"]`);
  await card.getByRole("button", { name: /Modifier/i }).click();
  await admin.waitForTimeout(500);
  const editForm = card.locator("form");
  await editForm.locator('input[type="file"]').setInputFiles(`${PICS}/banner-hiver.png`);
  await editForm.getByRole("button", { name: /Enregistrer/i }).click();
  await admin.waitForTimeout(2500);

  const after = await prisma.promotion.findUnique({ where: { id: before.id } });
  check("the banner points at new artwork", after.imageUrl !== before.imageUrl, after.imageUrl);
  check("the title and link survived the swap", after.title === before.title && after.href === before.href);
  check("the replaced picture is deleted, not orphaned",
    (await prisma.mediaAsset.count({ where: { id: oldAssetId } })) === 0);

  const res = await shop.request.get(`${BASE}/api/images/${oldAssetId}`, { maxRedirects: 0 });
  check("and a stale URL degrades instead of 500ing", res.status() === 302, `status ${res.status()}`);
}

console.log("\n[8] A PACK STILL SAYS WHAT IS IN THE BOX");
{
  const pack = await prisma.product.findFirst({ where: { sku: { startsWith: "PACK-" }, active: true } });
  if (!pack) {
    console.log("  SKIP  no pack products in the catalogue");
  } else {
    await shop.goto(`${BASE}/produit/${pack.slug}`);
    await shop.waitForTimeout(700);
    const text = await shop.locator("main").innerText();
    check("the product page lists the pack contents", /Dans le pack/i.test(text));
    const contents = pack.specs?.packContents ?? [];
    const named = await prisma.product.findMany({ where: { sku: { in: contents } }, select: { name: true, slug: true } });
    check("every part in the pack is named", named.every((p) => text.includes(p.name)), `${named.length} parts`);
    check("and each one links to its own page",
      (await shop.locator(`main a[href="/produit/${named[0].slug}"]`).count()) > 0);
    check("packContents is not dumped as raw JSON", !/packContents/.test(text));
  }
}

console.log("\n[9] DELETING CLEANS UP AFTER ITSELF");
{
  const promos = await prisma.promotion.findMany({ where: { placement: "CAMPAIGN" } });
  const assetIds = promos.map((p) => p.imageUrl.split("/").pop());
  admin.on("dialog", (d) => d.accept());
  await admin.goto(`${BASE}/admin/promotions`);
  await admin.waitForTimeout(900);
  for (let i = 0; i < promos.length; i++) {
    await admin.locator('button[aria-label="Supprimer"]').first().click();
    await admin.waitForTimeout(1800);
  }
  check("every campaign banner is gone", (await prisma.promotion.count({ where: { placement: "CAMPAIGN" } })) === 0);
  check("and its artwork with it", (await prisma.mediaAsset.count({ where: { id: { in: assetIds } } })) === 0);

  await shop.goto(BASE);
  await shop.waitForTimeout(800);
  check("the band disappears rather than showing an empty frame",
    (await shop.locator('section[aria-roledescription="carrousel"]').count()) === 0);
}

console.log("\n[10] HERO SLOTS RIDE IN THE SAME CAROUSEL");
{
  // They used to render as their own grid above the campaign band — a wide
  // featured image with a two-column grid under it. Both feeds now go through
  // one carousel, so a hero banner has to show up as a slide in it.
  const hero = parkedHeroes[0];
  if (!hero) {
    console.log("  SKIP  the shop has no hero banner of its own to check");
  } else {
    await prisma.promotion.update({ where: { id: hero.id }, data: { active: true } });
    await shop.goto(BASE);
    await shop.waitForTimeout(1500);

    const car = shop.locator('[aria-roledescription="carrousel"]');
    check("the carousel is on the page", (await car.count()) === 1, `${await car.count()} found`);
    const slides = await car.first().locator('[role="group"]').count();
    check("and the hero banner is one of its slides", slides >= 1, `${slides} slide(s)`);
    check("with no separate promo strip beside it",
          (await shop.locator('section[aria-label="Promotions"]').count()) === 0);

    await prisma.promotion.update({ where: { id: hero.id }, data: { active: false } });
  }
}


console.log("\n[X] ONE CAROUSEL, NOT ARTWORK SCATTERED ACROSS THE PAGE");
{
  // Two banners so the arrows and dots have a reason to exist.
  const made = [];
  for (const [i, kind] of [[1, "SEASONAL"], [2, "DEAL"]]) {
    const asset = await prisma.mediaAsset.create({
      data: { data: readFileSync(`${PICS}/banner-freinage.png`), mimeType: "image/png" },
      select: { id: true },
    });
    const promo = await prisma.promotion.create({
      data: { title: `QA carousel ${i}`, imageUrl: `/api/images/${asset.id}`, placement: "CAMPAIGN", kind, active: true, order: 90 + i },
    });
    made.push({ promoId: promo.id, assetId: asset.id });
  }

  const shop = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await shop.goto(BASE);
  await shop.waitForTimeout(1800);

  const carousels = shop.locator('[aria-roledescription="carrousel"]');
  check("the page carries exactly one promotional surface", (await carousels.count()) === 1,
        `${await carousels.count()} found`);

  const car = carousels.first();
  await car.scrollIntoViewIfNeeded();
  await shop.waitForTimeout(600);

  // One banner visible at a time, the rest scrolled off to the side.
  const geo = await car.evaluate((el) => {
    const track = el.querySelector('[role="group"]').parentElement;
    const slides = [...track.querySelectorAll('[role="group"]')];
    const box = track.getBoundingClientRect();
    const inView = slides.filter((s) => {
      const r = s.getBoundingClientRect();
      return r.left < box.right - 8 && r.right > box.left + 8;
    }).length;
    return { slides: slides.length, inView };
  });
  check("more than one banner is loaded", geo.slides > 1, `${geo.slides} slides`);
  check("but only one is on screen at a time", geo.inView === 1, `${geo.inView} visible`);

  check("arrows are offered to move between them",
        (await car.locator("button[aria-label]").filter({ hasNotText: /./ }).count()) >= 2 ||
        (await car.getByRole("button", { name: /suivant|précédent|next|previous/i }).count()) >= 2);

  // The arrow actually advances the carousel.
  const before = await car.evaluate((el) => el.querySelector('[role="group"]').parentElement.scrollLeft);
  await car.getByRole("button", { name: /suivant|next/i }).first().click();
  await shop.waitForTimeout(1200);
  const after = await car.evaluate((el) => el.querySelector('[role="group"]').parentElement.scrollLeft);
  check("the next arrow moves to the next banner", Math.abs(after) > Math.abs(before), `${before} → ${after}`);

  // And nothing renders promo artwork outside the carousel any more.
  const strays = await shop.evaluate(() => {
    const car = document.querySelector('[aria-roledescription="carrousel"]');
    return [...document.querySelectorAll('section[aria-label="Promotions"]')]
      .filter((s) => !car || !car.contains(s)).length;
  });
  check("no separate promo grid is left on the page", strays === 0, `${strays} stray section(s)`);

  await shop.close();
  for (const m of made) {
    await prisma.promotion.delete({ where: { id: m.promoId } });
    await prisma.mediaAsset.deleteMany({ where: { id: m.assetId } });
  }
}

// The shop's own hero banners go back exactly as they were.
if (parkedHeroes.length) {
  await prisma.promotion.updateMany({
    where: { id: { in: parkedHeroes.map((h) => h.id) } },
    data: { active: true },
  });
}
const restored = await prisma.promotion.count({ where: { placement: "HERO", active: true } });
check("the shop's own banners are switched back on", restored === parkedHeroes.length,
      `${restored} of ${parkedHeroes.length}`);

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
await prisma.$disconnect();
process.exit(fail > 0 ? 1 : 0);
