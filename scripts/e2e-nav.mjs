/**
 * The way into the catalogue: the phone drawer and the vehicle sheet.
 *
 * Both were rebuilt around a picture-per-category list and a drill-down, and
 * both are the first thing a shopper touches — a broken one costs the whole
 * visit. The checks here are the things that were actually wrong before, or
 * that would silently break: a category row whose image 404s, a drill-down
 * that unfolds instead of replacing, a search box that answers "clio" with
 * "no result", and a "best-stocked makes" panel appearing over tied numbers.
 *
 * Driven in a touch-emulated browser at a real phone width, against a
 * production build. See run-e2e.sh for why not `next dev`.
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
const PHONE_WIDTH = 390;
const ctx = await browser.newContext({
  viewport: { width: PHONE_WIDTH, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
p.on("pageerror", (e) => errors.push(String(e)));

const DRAWER = 'div[role="dialog"][aria-modal="true"]';

async function openDrawer() {
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(500);
  await p.click('button[aria-label="Ouvrir le menu"]');
  await p.waitForSelector(DRAWER);
  await p.waitForTimeout(350);
}

console.log("\n[1] THE DRAWER IS A LIST OF CATEGORIES, EACH WITH A PICTURE");
{
  await openDrawer();
  const rows = await p.$$(`${DRAWER} ul li button`);
  check("families are listed as rows", rows.length >= 10, `${rows.length} rows`);

  const imgs = await p.evaluate(
    (sel) =>
      [...document.querySelectorAll(`${sel} ul li button img`)].map((i) => ({
        src: i.currentSrc || i.src,
        w: i.naturalWidth,
      })),
    DRAWER
  );
  check("every family row carries a picture", imgs.length === rows.length, `${imgs.length}/${rows.length}`);
  check(
    "every picture decoded",
    imgs.length > 0 && imgs.every((i) => i.w > 0),
    imgs.filter((i) => !i.w).map((i) => i.src).join(", ") || "all"
  );
  // Either the shop's uploaded photo or the family line drawing — never a
  // stock image and never a broken box.
  check(
    "pictures come from our own two sources",
    imgs.every((i) => /\/api\/(images|part-icon)\//.test(i.src)),
    [...new Set(imgs.map((i) => (i.src.includes("part-icon") ? "part-icon" : "uploaded")))].join(" + ")
  );

  // A phone grows its layout viewport rather than showing a scrollbar, so this
  // is the only reliable way to catch an over-wide panel. See HANDOVER §6.
  check(
    "the drawer does not widen the layout viewport",
    (await p.evaluate(() => window.innerWidth)) === PHONE_WIDTH,
    `innerWidth=${await p.evaluate(() => window.innerWidth)}`
  );

  const tiny = await p.evaluate(
    (sel) =>
      [...document.querySelectorAll(`${sel} *`)]
        .filter((e) => e.children.length === 0 && (e.textContent || "").trim().length > 3)
        .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12).length,
    DRAWER
  );
  check("no text in the drawer falls below the 12px floor", tiny === 0, `${tiny} element(s)`);
}

console.log("\n[2] TAPPING A FAMILY REPLACES THE SCREEN, IT DOES NOT UNFOLD");
{
  const rows = await p.$$(`${DRAWER} ul li button`);
  const rowLabel = (await rows[0].innerText()).split("\n")[0].trim();
  await rows[0].click();
  await p.waitForTimeout(350);

  const header = (await p.textContent(`${DRAWER} h2`)).trim();
  check("the header becomes the family's name", header.toUpperCase() === rowLabel.toUpperCase(), `"${header}" vs "${rowLabel}"`);
  check("the other families left the screen", (await p.$$(`${DRAWER} ul li button`)).length === 0);

  const links = await p.$$eval(`${DRAWER} a[href^="/catalogue/"]`, (as) => as.map((a) => a.getAttribute("href")));
  check("the family's own page is the first row", links.length > 0 && links[0].split("/").length === 3, links[0]);
  check("its subcategories follow", links.length >= 2, `${links.length} links`);

  const subImgs = await p.evaluate(
    (sel) => [...document.querySelectorAll(`${sel} a[href^="/catalogue/"] img`)].map((i) => i.naturalWidth),
    DRAWER
  );
  check(
    "subcategory rows carry pictures too",
    subImgs.length === links.length && subImgs.every((w) => w > 0),
    `${subImgs.filter((w) => w > 0).length}/${links.length} decoded`
  );

  await p.click(`${DRAWER} button[aria-label="Retour"]`);
  await p.waitForTimeout(300);
  check("back returns to the family list", (await p.$$(`${DRAWER} ul li button`)).length >= 10);
}

console.log("\n[3] A SUBCATEGORY ROW ACTUALLY GOES SOMEWHERE");
{
  await (await p.$$(`${DRAWER} ul li button`))[0].click();
  await p.waitForTimeout(300);
  const links = await p.$$eval(`${DRAWER} a[href^="/catalogue/"]`, (as) => as.map((a) => a.getAttribute("href")));
  const target = links[1];
  await p.click(`${DRAWER} a[href="${target}"]`);
  await p.waitForURL("**" + target, { timeout: 15000 });
  check("it lands on the subcategory page", p.url().endsWith(target), p.url());
  check("the drawer closed behind it", (await p.$$(DRAWER)).length === 0);
  const h1 = await p.textContent("h1");
  check("the page has its own heading", (h1 || "").trim().length > 0, (h1 || "").trim());
}

console.log("\n[4] THE VEHICLE SHEET LISTS MAKES WITH REAL COVERAGE");
{
  await openDrawer();
  await p.click(`${DRAWER} button:has-text("véhicule")`);
  await p.waitForSelector(DRAWER);
  await p.waitForTimeout(400);
  await p.click('button:has-text("Je connais ma voiture")');
  await p.waitForTimeout(600);

  const txt = await p.textContent(DRAWER);
  check("each make says how many parts we hold for it", /\d+ pièces/.test(txt), (txt.match(/\d+ pièces/) || ["none"])[0]);
  // The panel is data-gated: it may only appear when the sixth make genuinely
  // outstocks the seventh. On a catalogue of generic servicing parts they tie,
  // so a panel here would be an alphabetical tie-break dressed as advice.
  const ranked = txt.includes("mieux fournies");
  const heading = txt.includes("Toutes les marques") || txt.includes("Autres marques");
  check("the make list is headed", heading, ranked ? "ranked block shown" : "flat list");
  check("a ranked block only appears alongside a remainder list", !ranked || txt.includes("Autres marques"));
  check("there is a way out of this screen", txt.includes("sans choisir"));
}

console.log("\n[5] TYPING A MODEL NAME FINDS THE MODEL, NOT 'NO RESULT'");
{
  await p.fill(`${DRAWER} input[type="search"]`, "clio");
  await p.waitForTimeout(400);
  const txt = await p.textContent(DRAWER);
  check("it does not dead-end", !txt.includes("Aucun résultat"));
  check("the model is offered with its make", /Renault\s+Clio/i.test(txt), (txt.match(/Renault\s+Clio\s*\S*/i) || ["none"])[0]);

  await p.click(`${DRAWER} button:has-text("Clio")`);
  await p.waitForTimeout(400);
  const engines = await p.textContent(DRAWER);
  check("it jumps straight to the motorisation step", /essence|diesel/i.test(engines), engines.replace(/\s+/g, " ").slice(0, 80));

  const engBtn = (await p.$$(`${DRAWER} ul li button`))[0];
  const engName = (await engBtn.innerText()).split("\n")[0].trim();
  await engBtn.click();
  await p.waitForTimeout(700);
  const saved = await p.evaluate(() => localStorage.getItem("apa-vehicle"));
  check("the vehicle is saved to the garage", !!saved && saved.includes("Clio"), (saved || "").slice(0, 100));
  check("with the engine that was tapped", !!saved && saved.includes(engName), engName);
}

console.log("\n[6] THE PLATE QUESTION IS ANSWERED, NOT FAKED");
{
  await openDrawer();
  await p.click(`${DRAWER} button:has-text("véhicule")`);
  await p.waitForTimeout(400);
  // A saved vehicle now sits above the two choices; the chooser is still there.
  await p.click('button:has-text("Je ne sais pas")');
  await p.waitForTimeout(400);
  const txt = await p.textContent(DRAWER);
  check(
    "it explains why there is no plate lookup",
    txt.includes("immatriculation") && txt.includes("registre"),
    (txt.match(/Par immatriculation[^.]*\./) || ["missing"])[0].slice(0, 80)
  );
  check("and offers no plate box to type into", (await p.$$('input[aria-label*="mmatricul" i]')).length === 0);
  check("the carte grise route is still the first offer", txt.includes("carte grise"));
}

console.log("\n[7] THE DESKTOP FLYOUT STILL FITS ITS ROW");
{
  const d = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const dp = await d.newPage();
  for (const w of [1024, 1280, 1440]) {
    await dp.setViewportSize({ width: w, height: 900 });
    await dp.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await dp.waitForTimeout(500);
    await dp.hover("header nav button");
    await dp.waitForTimeout(450);
    const r = await dp.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
      thumbs: document.querySelectorAll("header a[href^='/catalogue/'] img").length,
    }));
    check(`no horizontal overflow at ${w}px`, r.scroll <= r.inner, `${r.scroll} vs ${r.inner}`);
    check(`the flyout rows carry pictures at ${w}px`, r.thumbs >= 10, `${r.thumbs} images`);
  }
  await d.close();
}

console.log("\n[8] NOTHING BROKE IN THE CONSOLE");
check("clean console", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
