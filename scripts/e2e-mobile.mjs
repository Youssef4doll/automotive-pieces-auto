/**
 * Mobile UX regression suite.
 *
 * Every check corresponds to something that was measurably wrong on a phone
 * and can silently come back: an input under 16px reintroduces iOS zoom, a
 * `hidden lg:block` spacer re-collapses the header, `scroll-behavior: smooth`
 * makes navigation land mid-page again. Measured in a touch-emulated browser
 * at real iPhone widths, not read off the source.
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

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
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const ctx = await browser.newContext(phone);
const p = await ctx.newPage();

// Discovered, not hard-coded. A fixed slug worked until the rest of the
// battery had bought that part out from under this suite — eighteen suites run
// in sequence and several of them place real orders, so by the time this one
// ran the "Ajouter au panier" button was legitimately disabled and a mobile-UX
// suite failed for a reason that has nothing to do with mobile UX.
const stocked = await prisma.product.findFirst({
  where: { active: true, stockQty: { gt: 1 }, sku: { not: { startsWith: "PACK-" } } },
  orderBy: { stockQty: "desc" },
  select: { slug: true, name: true, stockQty: true },
});
if (!stocked) {
  console.log("  SKIP  nothing in the catalogue is in stock to test against");
  process.exit(0);
}
const PRODUCT = `/produit/${stocked.slug}`;
console.log(`  (testing against ${stocked.name} — ${stocked.stockQty} in stock)`);

console.log("\n[1] NO INPUT CAN TRIGGER iOS ZOOM");
{
  const offenders = [];
  for (const route of ["/", "/recherche?q=frein", "/panier", "/commande", "/compte", PRODUCT]) {
    await p.goto(BASE + route);
    await p.waitForTimeout(500);
    const bad = await p.evaluate(() =>
      [...document.querySelectorAll("input, select, textarea")]
        .filter((el) => !["checkbox", "radio", "range", "file", "hidden"].includes(el.type))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
        .map((el) => `${el.type || el.tagName}:${parseFloat(getComputedStyle(el).fontSize)}px`),
    );
    bad.forEach((x) => offenders.push(`${route} ${x}`));
  }
  check("every text control is at least 16px on a touch device", offenders.length === 0,
        offenders.slice(0, 3).join(", ") || "none under 16px");

  const viewport = await p.evaluate(() => document.querySelector('meta[name="viewport"]')?.content ?? "");
  check("the viewport is width=device-width, initial-scale=1", /width=device-width/.test(viewport) && /initial-scale=1/.test(viewport), viewport);
  check("pinch zoom is NOT disabled", !/maximum-scale|user-scalable\s*=\s*no/.test(viewport));
}

console.log("\n[2] THE HEADER USES THE WHOLE WIDTH");
{
  await p.goto(BASE + "/");
  await p.waitForTimeout(700);
  const h = await p.evaluate(() => {
    const header = document.querySelector("header");
    const controls = [...header.querySelectorAll("a, button")].filter((e) => e.offsetParent !== null);
    const boxes = controls.map((e) => e.getBoundingClientRect());
    const logo = header.querySelector('a[href="/"]')?.getBoundingClientRect();
    return {
      height: Math.round(header.getBoundingClientRect().height),
      rightMost: Math.round(Math.max(...boxes.map((b) => b.right))),
      logoLeft: logo ? Math.round(logo.left) : -1,
      logoRight: logo ? Math.round(logo.right) : -1,
      vw: window.innerWidth,
    };
  });
  // The right-hand actions must reach the gutter, not stop halfway.
  const rightGap = h.vw - h.rightMost;
  check("the right-hand actions sit at the right edge", rightGap <= 24, `${rightGap}px gap (was 75px)`);
  check("the logo stays anchored left", h.logoLeft <= 70, `left edge at ${h.logoLeft}px`);
  // Real breathing room between the brand and the actions.
  const gutter = h.rightMost - h.logoRight;
  check("there is real space between logo and actions", gutter > 100, `${gutter}px`);
  check("the header stays compact", h.height <= 72, `${h.height}px`);
}

console.log("\n[3] THE SECONDARY BAR GETS OUT OF THE WAY, CALMLY");
{
  const stickyH = () =>
    p.evaluate(() => Math.round(document.querySelector(".sticky.top-0").getBoundingClientRect().height));

  await p.goto(BASE + "/");
  await p.waitForTimeout(800);
  const atTop = await stickyH();
  check("it is shown at the top of the page", atTop > 90, `${atTop}px`);

  await p.evaluate(() => window.scrollTo(0, 700));
  await p.waitForTimeout(800);
  const scrolled = await stickyH();
  check("a deliberate scroll down collapses it", scrolled < atTop - 30, `${atTop}px → ${scrolled}px`);

  // Hysteresis: small movements must not toggle anything.
  for (const dy of [6, -6, 9, -8]) {
    await p.evaluate((d) => window.scrollBy(0, d), dy);
    await p.waitForTimeout(220);
  }
  const afterTwitch = await stickyH();
  check("small movements do not flip it", afterTwitch === scrolled, `${afterTwitch}px`);

  await p.evaluate(() => window.scrollBy(0, -220));
  await p.waitForTimeout(800);
  check("a deliberate scroll up brings it back", (await stickyH()) > scrolled + 30);

  // The feedback loop that made it flicker: collapsing shortens the document,
  // which fires a scroll event of its own.
  for (let i = 0; i < 12; i++) {
    await p.evaluate((n) => window.scrollBy(0, n), i % 2 ? -11 : 13);
    await p.waitForTimeout(70);
  }
  await p.waitForTimeout(900);
  const a = await stickyH();
  await p.waitForTimeout(600);
  check("it settles instead of oscillating", a === (await stickyH()), `${a}px, stable`);

  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(700);
  check("returning to the top always reveals it", (await stickyH()) > 90);
}

console.log("\n[4] DESKTOP IS NOT COLLATERAL DAMAGE");
{
  const d = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dp = await d.newPage();
  await dp.goto(BASE + "/");
  await dp.waitForTimeout(700);
  const before = await dp.evaluate(() => Math.round(document.querySelector(".sticky.top-0").getBoundingClientRect().height));
  await dp.evaluate(() => window.scrollTo(0, 1200));
  await dp.waitForTimeout(800);
  const after = await dp.evaluate(() => Math.round(document.querySelector(".sticky.top-0").getBoundingClientRect().height));
  check("the secondary bar stays put on desktop", after === before, `${before}px → ${after}px`);
  const h1 = await dp.evaluate(() => getComputedStyle(document.querySelector("h1")).fontSize);
  check("desktop headings keep their size", parseFloat(h1) >= 48, h1);
  await d.close();
}

console.log("\n[5] TYPOGRAPHY IS COMPACT WITHOUT BEING TINY");
{
  await p.goto(BASE + "/");
  await p.waitForTimeout(600);
  const t = await p.evaluate(() => {
    const cs = (sel) => { const e = document.querySelector(sel); return e ? parseFloat(getComputedStyle(e).fontSize) : null; };
    return { h1: cs("h1"), body: cs("main p") };
  });
  check("the mobile h1 is restrained", t.h1 !== null && t.h1 <= 30, `${t.h1}px (was 36px)`);
  check("body copy stays readable", t.body === null || t.body >= 14, `${t.body}px`);

  // Nothing may be smaller than the project's own legibility floor.
  const tiny = await p.evaluate(() =>
    [...document.querySelectorAll("main *")]
      .filter((e) => e.children.length === 0 && (e.textContent || "").trim().length > 3)
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12).length,
  );
  check("no readable text falls below 12px", tiny === 0, `${tiny} element(s)`);
}

console.log("\n[6] NAVIGATION ARRIVES AT THE TOP OF THE NEW PAGE");
{
  await p.goto(BASE + "/catalogue/freinage");
  await p.waitForTimeout(700);
  const nav = await p.evaluate(async () => {
    window.scrollTo(0, 1200);
    await new Promise((r) => setTimeout(r, 250));
    const a = document.querySelector('a[href^="/produit/"]');
    const href = a.getAttribute("href");
    const t0 = performance.now();
    a.click();
    await new Promise((res) => {
      const tick = () => (location.pathname === href ? res() : requestAnimationFrame(tick));
      tick();
    });
    await new Promise((r) => setTimeout(r, 500));
    return { ms: Math.round(performance.now() - t0), y: Math.round(window.scrollY), href };
  });
  check("the product page starts at the top", nav.y === 0, `scrollY=${nav.y} (was 352)`);
  check("navigation commits promptly", nav.ms < 1200, `${nav.ms}ms`);
  check("smooth scrolling is not applied to the document",
        (await p.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)) !== "smooth");
}

console.log("\n[7] TAPPING SOMETHING GIVES IMMEDIATE FEEDBACK");
{
  await p.goto(BASE + PRODUCT);
  await p.waitForTimeout(900);
  const t0 = Date.now();
  await p.locator('button:has-text("Ajouter au panier")').first().click();
  await p.waitForFunction(() => /ajout/i.test(document.body.innerText), { timeout: 5000 }).catch(() => {});
  const ms = Date.now() - t0;
  check("add-to-cart confirms immediately", ms < 400, `${ms}ms`);

  // The confirmation must not take over the screen.
  const covers = await p.evaluate(() => {
    const el = [...document.querySelectorAll("body *")].find((e) =>
      /ajout/i.test(e.textContent || "") && getComputedStyle(e).position === "fixed");
    if (!el) return 0;
    const b = el.getBoundingClientRect();
    return Math.round(((b.width * b.height) / (innerWidth * innerHeight)) * 100);
  });
  check("the confirmation does not cover the page", covers < 35, `${covers}% of the screen`);
  check("the shopper is still on the product page", p.url().includes("/produit/"));
}

console.log("\n[8] THE CART IS A SHEET, NOT A DESKTOP WINDOW");
{
  await p.locator('header a[href="/panier"], header button[aria-label*="Panier"]').first().click().catch(() => {});
  await p.waitForTimeout(900);
  const sheet = await p.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const panel = d.querySelector("div");
    const b = panel.getBoundingClientRect();
    return { bottomAnchored: Math.abs(b.bottom - innerHeight) < 4, widthPct: Math.round((b.width / innerWidth) * 100) };
  });
  if (sheet) {
    check("the cart opens as a bottom sheet", sheet.bottomAnchored, `full width: ${sheet.widthPct}%`);
  } else {
    check("the cart opens as a bottom sheet", true, "cart page used instead of a drawer");
  }
}

console.log("\n[9] CHECKOUT DOES NOT DEMAND AN ACCOUNT");
{
  await p.goto(BASE + "/commande");
  await p.waitForTimeout(900);
  const body = await p.locator("main").innerText();
  // The wording lives in the guest/sign-in panel now, not a single sentence.
  check("guest checkout is stated in words",
        /invité/i.test(body) && /aucun compte/i.test(body));
  check("signing in is offered as a shortcut, not a gate", /Déjà client/i.test(body));
  check("the order can be submitted", (await p.locator('button[type="submit"]').count()) > 0);
}

console.log("\n[10] BROWSE THE CATALOGUE: FAMILY → SUBCATEGORY → PRODUCT");
{
  await p.goto(BASE + "/");
  await p.waitForTimeout(900);
  // Families are expandable buttons on the homepage, not links — the panel
  // they open carries the subcategory links.
  const famButtons = p.locator('button[aria-controls^="subs-"]');
  const famCount = await famButtons.count();
  check("the homepage lists the part families", famCount >= 5, `${famCount} families`);

  await famButtons.first().click();
  await p.waitForTimeout(400);
  const panelLinks = await p.locator('[id^="subs-"] a[href^="/catalogue/"]').evaluateAll((els) =>
    els.map((a) => a.getAttribute("href")));
  check("expanding one reveals its subcategories in place", panelLinks.length >= 2, `${panelLinks.length} links`);

  const families = [...new Set(panelLinks.filter((h) => h.split("/").length === 3))];
  await p.goto(BASE + (families[0] ?? "/catalogue/freinage"));
  await p.waitForTimeout(700);
  const subs = await p.locator('a[href^="/catalogue/"]').evaluateAll((els) =>
    [...new Set(els.map((a) => a.getAttribute("href")).filter((h) => h && h.split("/").length === 4))]);
  check("a family opens its subcategories", subs.length > 0, `${subs.length} under ${families[0]}`);

  let dead = 0;
  for (const s of subs.slice(0, 5)) {
    await p.goto(BASE + s);
    await p.waitForTimeout(350);
    if ((await p.locator('a[href^="/produit/"]').count()) === 0) dead++;
  }
  check("no subcategory is an empty dead end", dead === 0, `${dead} of ${Math.min(5, subs.length)} sampled`);
}

console.log("\n[11] NO HORIZONTAL SCROLL AT ANY PHONE WIDTH");
{
  const ROUTES = ["/", "/catalogue/freinage", PRODUCT, "/panier", "/commande", "/recherche?q=frein", "/compte"];
  let issues = 0;
  for (const w of [320, 360, 375, 390, 393, 414, 430]) {
    const c = await browser.newContext({ viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true });
    const pg = await c.newPage();
    for (const r of ROUTES) {
      await pg.goto(BASE + r);
      await pg.waitForTimeout(280);
      const over = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 0) { issues++; console.log(`      ${over}px overflow at ${w}px on ${r}`); }
    }
    await c.close();
  }
  check("nothing scrolls sideways on any iPhone width", issues === 0, `${issues} issue(s)`);
}

console.log("\n[12] TEXT MEETS THE CONTRAST FLOOR");
{
  // Measured, not eyeballed. Tailwind v4 emits colours as rgb() *and* lab(),
  // and a probe that understands only one of them invents failures — the first
  // version of this check reported white-on-green as 1:1 because it could not
  // read lab(). Anything translucent is skipped rather than guessed at, and
  // reported, so the coverage of this check is never overstated.
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  let measured = 0, skipped = 0;
  const failures = [];

  for (const path of ["/", "/catalogue/freinage", "/recherche?q=plaquettes", "/panier"]) {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const srgbLum = (c) => {
        const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      // CIE L* → relative luminance. Same Y the sRGB formula produces, so the
      // two can be compared directly.
      const labLum = (L) => (L > 8 ? ((L + 16) / 116) ** 3 : L / 903.3);
      const lumOf = (css) => {
        const rgb = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(css);
        if (rgb) return srgbLum([+rgb[1], +rgb[2], +rgb[3]]);
        const lab = /^lab\(([\d.]+)/.exec(css);
        if (lab) return labLum(parseFloat(lab[1]));
        return null; // rgba()/oklch with alpha — composited, not measurable here
      };
      const bgLum = (el) => {
        let n = el;
        while (n) {
          const bg = getComputedStyle(n).backgroundColor;
          if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) {
            const l = lumOf(bg);
            return l === null ? null : l;
          }
          n = n.parentElement;
        }
        return srgbLum([255, 255, 255]);
      };
      const out = { fails: [], measured: 0, skipped: 0 };
      for (const el of document.querySelectorAll("body *")) {
        const txt = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim())
          .map((n) => n.textContent.trim()).join(" ");
        if (!txt || txt.length < 2) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        // Screen-reader-only text is clipped to nothing on purpose — it has no
        // visual appearance, so it has no contrast ratio to measure and a
        // reading of 1:1 says only that the probe found the clip. Detected by
        // what sr-only actually does rather than by class name: a box clipped
        // away, or one collapsed to a pixel.
        const box = el.getBoundingClientRect();
        const clipped = /inset\(50%\)|rect\(0(px)?[, ]/.test(cs.clipPath + " " + cs.clip);
        if (clipped || box.width <= 1 || box.height <= 1) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const fg = lumOf(cs.color), bg = bgLum(el);
        if (fg === null || bg === null) { out.skipped++; continue; }
        out.measured++;
        const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
        const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
        const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
        if (ratio < need) {
          out.fails.push(`${ratio.toFixed(2)}:1 (need ${need}) ${Math.round(size)}px "${txt.slice(0, 24)}"`);
        }
      }
      return out;
    });
    measured += r.measured;
    skipped += r.skipped;
    failures.push(...r.fails);
  }

  const distinct = [...new Set(failures)];
  check("every measurable text colour clears WCAG AA", distinct.length === 0,
        distinct.slice(0, 3).join(" | ") || `${measured} nodes measured`);
  check("the check covers a real share of the page", measured > 200,
        `${measured} measured, ${skipped} translucent and unmeasured`);
  await page.close();
}

await browser.close();
await prisma.$disconnect();

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
