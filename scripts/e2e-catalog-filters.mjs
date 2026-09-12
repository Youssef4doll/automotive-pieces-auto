/**
 * The category page's brand filter, now that it is checkboxes instead of a
 * single toggle.
 *
 * It used to accept one brand at a time (`?brand=kamoka`, clicking a second
 * one replaced the first). A shopper who trusts two brands and wants either
 * one had no way to ask for that. These checks drive the real sidebar,
 * confirm several brands really OR together (the result count has to be the
 * sum, not the count of whichever was clicked last), and that the desktop
 * sidebar, the phone's chip row and the mobile drawer's picture grid all
 * agree with each other and with a URL typed in directly.
 *
 * "Filtres" is used throughout because it seeds with five distinct brands at
 * known counts (Kamoka 8, Ashika 5, Mann-Filter 1, Valeo 1, Febi 1) and
 * nothing else in the battery renames or restocks it — only places orders
 * against other categories.
 *
 * Driven against a production build. See run-e2e.sh for why not `next dev`.
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { findStockedProduct } from "./lib/stocked-product.mjs";

const prisma = new PrismaClient();
const BASE = process.env.BASE_URL || "http://localhost:3000";

let pass = 0;
let fail = 0;
function check(label, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

console.log("\n[1] THE DESKTOP SIDEBAR: TWO BOXES OR TOGETHER");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/catalogue/filtres`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(500);

  const totalText = await p.textContent("main h1 + p, main p");
  check("starts unfiltered", /16 référence/.test(await p.textContent("main")), "expect 16 before any brand is picked");

  await p.click('aside a:has-text("Kamoka")');
  await p.waitForURL(/brand=kamoka$/, { timeout: 5000 });
  check("one box checked filters to that brand's count", /8 référence/.test(await p.textContent("main")));

  // Not /brand=/ — that already matches the URL from the click above, so
  // waitForURL would resolve immediately without waiting for this second
  // navigation at all. Wait for the thing that is actually new.
  await p.click('aside a:has-text("Ashika")');
  await p.waitForURL(/ashika/, { timeout: 5000 });
  const url1 = p.url();
  check("the URL carries both slugs", /kamoka/.test(url1) && /ashika/.test(url1), url1);
  check(
    "two boxes checked sum their counts (OR, not the last click winning)",
    /13 référence/.test(await p.textContent("main")),
    "expect 8 + 5 = 13"
  );

  const checked = await p.$$eval('aside ul li a[aria-pressed="true"]', (as) => as.map((a) => a.textContent.trim()));
  check("both boxes show as checked", checked.some((t) => t.includes("Kamoka")) && checked.some((t) => t.includes("Ashika")), checked.join(" | "));

  const chipTexts = await p.$$eval("main a", (as) =>
    as.filter((a) => a.textContent.includes("✕")).map((a) => a.textContent.trim())
  );
  check("a removable chip exists for each active brand", chipTexts.length === 2, chipTexts.join(", "));

  // Unchecking one drops only that brand's products.
  await p.click('aside a:has-text("Ashika")');
  await p.waitForURL(/brand=kamoka$/, { timeout: 5000 });
  check("unchecking one brand returns to just the other's count", /8 référence/.test(await p.textContent("main")));

  // The counts beside each brand name never move — they describe the whole
  // category, not the current selection.
  const kamokaCount = await p.textContent('aside li:has-text("Kamoka") span.tabular-nums');
  check("brand counts stay fixed while filtering", kamokaCount.trim() === "8", kamokaCount);

  await ctx.close();
}

console.log("\n[2] A DIRECT URL WITH SEVERAL BRANDS WORKS WITHOUT CLICKING ANYTHING");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/catalogue/filtres?brand=kamoka,mann-filter`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(500);
  check(
    "the OR'd total is right straight from a shared link",
    /9 référence/.test(await p.textContent("main")),
    "expect 8 + 1 = 9"
  );
  const checked = await p.$$eval('aside ul li a[aria-pressed="true"]', (as) => as.map((a) => a.textContent.trim()));
  check("both boxes are pre-checked from the URL", checked.length === 2, checked.join(" | "));
  await ctx.close();
}

console.log("\n[3] SORTING KEEPS THE BRAND SELECTION");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/catalogue/filtres?brand=kamoka,ashika`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(500);
  await p.selectOption("select", "price-asc");
  await p.waitForURL(/sort=price-asc/, { timeout: 5000 });
  const url = p.url();
  check("changing sort does not drop the brands", /kamoka/.test(url) && /ashika/.test(url) && /sort=price-asc/.test(url), url);
  await ctx.close();
}

console.log("\n[4] THE PHONE'S CHIP ROW DOES THE SAME THING");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/catalogue/filtres`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(500);

  const row = p.locator("div.overflow-x-auto").filter({ hasText: "Kamoka" }).first();
  await row.locator('a:has-text("Kamoka")').click();
  await p.waitForURL(/brand=kamoka/, { timeout: 5000 });
  await row.locator('a:has-text("Ashika")').click();
  await p.waitForURL(/ashika/, { timeout: 5000 });
  check(
    "two taps on the phone's chip row also sum to 13",
    /13 référence/.test(await p.textContent("main")),
    await p.url()
  );

  const tiny = await p.evaluate(() =>
    [...document.querySelectorAll("main *")]
      .filter((e) => e.children.length === 0 && (e.textContent || "").trim().length > 1)
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12).length
  );
  check("brand chip labels stay at or above the 12px floor", tiny === 0, `${tiny} element(s)`);
  check(
    "the layout viewport did not widen under the chip row",
    (await p.evaluate(() => window.innerWidth)) === 390
  );
  await ctx.close();
}

console.log("\n[5] BIGGER PICTURES: THE SUBCATEGORY GRIDS THAT REPLACED PLAIN LISTS");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  // The desktop mega-menu flyout.
  await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(600);
  await p.hover('header button:has-text("Produits")');
  await p.waitForTimeout(300);
  const rail = p.locator('header a[href^="/catalogue/"]');
  await rail.nth(1).hover(); // a family with several subcategories (Freinage)
  await p.waitForTimeout(300);

  const tiles = await p.evaluate(() => {
    const links = [...document.querySelectorAll('header div.p-6 a[href*="/catalogue/"]')].filter(
      (a) => a.getAttribute("href")?.split("/").length === 4
    );
    return links.map((a) => ({
      img: a.querySelector("img"),
      w: a.querySelector("img")?.getAttribute("width") || a.querySelector("img")?.style.width,
    }));
  });
  check("the flyout's subcategories are tiles with pictures", tiles.length >= 2, `${tiles.length} tiles`);

  const imgSizes = await p.evaluate(() =>
    [...document.querySelectorAll('header div.p-6 img')].map((i) => i.getBoundingClientRect().width)
  );
  check(
    "the pictures are meaningfully bigger than the old 24px row icon",
    imgSizes.length > 0 && imgSizes.every((w) => w >= 44),
    imgSizes.join(", ")
  );

  // The homepage's expanded family card.
  await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(600);
  await p.evaluate(() => document.getElementById("symptomes")?.scrollIntoView());
  await p.click('#symptomes button[aria-expanded]');
  await p.waitForTimeout(300);
  const homeImgSizes = await p.evaluate(() =>
    [...document.querySelectorAll("#symptomes img")].filter((i) => i.closest("a")).map((i) => i.getBoundingClientRect().width)
  );
  check(
    "the homepage's subcategory panel also shows real pictures, not bare text rows",
    homeImgSizes.length > 0 && homeImgSizes.every((w) => w >= 36),
    homeImgSizes.join(", ")
  );

  await ctx.close();
}

console.log("\n[6] THE LIST ROW SAYS WHAT THE SHOP KNOWS, AND NOTHING ELSE");
{
  // The row is modelled on the specialist parts catalogues: maker's mark,
  // name, labels, the reference, what the part actually is, and a price block
  // with the quantity beside the button. Every one of those is a real field —
  // the spec rows in particular appear only once somebody has filled them in,
  // which is what this section drives from both sides.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();

  const toList = async () => {
    await p.goto(`${BASE}/catalogue/filtres`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(700);
    await p.locator('[role="group"][aria-label="Affichage"] button').last().click();
    await p.waitForTimeout(500);
  };

  await toList();
  const row = p.locator('main div:has(> div > a[href^="/produit/"])').first();
  check("a list row carries a quantity beside the button", (await p.locator("main select#qty-" ).count()) >= 0 && (await p.locator('main select[id^="qty-"]').count()) > 0);
  check("and the add button next to it", (await p.locator('main button:has-text("Ajouter au panier")').count()) > 0);

  // Nothing invented: with an empty specs bag there is no spec block at all,
  // and no row of blank labels standing in for one.
  const before = await p.textContent("main");
  check("with no specs filled in, no spec rows are printed", !/Position :|Réf\. OE :/.test(before));

  // Now fill some in, the way the admin would, and read the same page back.
  const target = await prisma.product.findFirst({
    where: { active: true, category: { parent: { slug: "filtres" } } },
    select: { id: true, name: true, specs: true, oemRefs: true, axle: true },
  });
  if (!target) {
    check("there is a product to describe", false);
  } else {
    await prisma.product.update({
      where: { id: target.id },
      data: {
        axle: "AVANT",
        oemRefs: ["8001063523620", "1109AY"],
        specs: { "Hauteur (mm)": "98,6", "Type de filtre": "Cartouche", "Diamètre (mm)": "82" },
      },
    });
    await toList();
    const after = await p.textContent("main");
    check("the position it fits is printed", /Position :\s*Avant/.test(after));
    // Ahead of the measurements, deliberately: only the first few rows are
    // shown, and the number a mechanic matches the part by must not be the
    // one pushed off the card by a height in millimetres.
    check("the manufacturer's numbers come next", /Réf\. OE :[\s\S]{0,40}8001063523620/.test(after));
    check("then the shop's own specs", /Hauteur \(mm\) :\s*98,6/.test(after));
    check("with a way to the rest of them", /Voir toutes les caractéristiques/.test(after));

    await prisma.product.update({
      where: { id: target.id },
      data: { specs: target.specs, oemRefs: target.oemRefs, axle: target.axle },
    });
    await toList();
    const restored = await p.textContent("main");
    check("emptying them again leaves nothing behind", !/Position :|Hauteur \(mm\) :/.test(restored));
  }

  // The quantity is the point of putting a selector there at all: it has to
  // reach the cart, not be read and dropped.
  //
  // Driven on whichever listing actually holds something buyable, not on
  // "Filtres": the selector is capped by real stock, suites before this one
  // place real orders, and that family has been bought to zero before now.
  const stocked = await findStockedProduct(prisma, 2);
  if (stocked) {
    await p.goto(`${BASE}${stocked.catalogPath}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(700);
    await p.locator('[role="group"][aria-label="Affichage"] button').last().click();
    await p.waitForTimeout(500);
  }
  const selects = p.locator('main select[id^="qty-"]');
  let qty = null;
  let want = 0;
  for (let i = 0; i < (await selects.count()); i++) {
    const options = await selects.nth(i).locator("option").count();
    if (options >= 2) {
      qty = selects.nth(i);
      want = Math.min(3, options);
      break;
    }
  }
  if (!qty) {
    check("there is a part with more than one in stock to order", false);
  } else {
    await qty.selectOption(String(want));
    // The button sitting beside that selector, not the first one on the page:
    // the quantity only means anything against the row it was chosen in.
    await qty.locator("xpath=..").locator('button:has-text("Ajouter au panier")').first().click();
    await p.waitForTimeout(900);
    const stored = await p.evaluate(() => JSON.parse(localStorage.getItem("apa-cart") || "{}")?.state?.items ?? []);
    check("the chosen quantity is what reaches the cart",
      stored.length > 0 && stored.some((i) => i.qty === want),
      `asked for ${want}, cart holds ${stored.map((i) => `${i.qty}×`).join(" ") || "nothing"}`);
  }

  await ctx.close();
}

await browser.close();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
