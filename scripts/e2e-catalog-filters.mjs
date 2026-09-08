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

await browser.close();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
