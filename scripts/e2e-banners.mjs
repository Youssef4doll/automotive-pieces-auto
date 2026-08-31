// Proves the campaign band is the shop's to run, not ours to fake: an admin
// uploads artwork, it becomes bytes in Postgres served by /api/images, and it
// appears on the home page as a real carousel. Also holds the line on the
// invented content that used to sit in this part of the page — testimonials
// nobody wrote and an average rating nobody measured.
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

// Start from a known state: no campaign banners at all.
await prisma.promotion.deleteMany({ where: { placement: "CAMPAIGN" } });

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
await admin.waitForURL(`${BASE}/admin`, { timeout: 15000 });

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

console.log("\n[10] THE TOP STRIP IS UNTOUCHED BY ALL OF THIS");
{
  const hero = await prisma.promotion.count({ where: { placement: "HERO", active: true } });
  await shop.goto(BASE);
  await shop.waitForTimeout(800);
  const strip = await shop.locator('section[aria-label="Promotions"]').count();
  check("the hero strip still renders its own banners", strip === (hero > 0 ? 1 : 0), `${hero} hero banner(s)`);
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
await prisma.$disconnect();
process.exit(fail > 0 ? 1 : 0);
