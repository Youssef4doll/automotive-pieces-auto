// Four things a walkthrough of the shop turned up, each one a reason a real
// customer leaves without buying:
//
//   1. The cart called the subtotal "Total" and checkout then added 8 DT.
//   2. Out-of-stock parts led the listings — six of the first eight in
//      Freinage, with the first three in a row unbuyable.
//   3. Nothing had a photo, and every product fell back to the hero artwork,
//      so a brake disc's page showed a bottle of engine oil.
//   4. On a phone the hero's search placeholder rendered as "Recherc".
//
// These are the checks that stop each of them coming back.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};
const money = (s) => {
  const m = s.match(/([\d\s.,]+)\s*DT/);
  return m ? Number(m[1].replace(/\s/g, "").replace(",", ".")) : null;
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

/* ------------------------------------------------------------------ */
console.log("\n[1] THE CART QUOTES DELIVERY, AND CHECKOUT AGREES WITH IT");
{
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();

  // Something cheap enough that delivery is actually charged — a basket over
  // the free threshold would prove nothing about the bug.
  const cheap = await prisma.product.findFirst({
    where: { active: true, stockQty: { gt: 0 } },
    orderBy: { priceSell: "asc" },
    select: { slug: true, name: true },
  });
  await p.goto(`${BASE}/produit/${cheap.slug}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await p.locator('button:has-text("Ajouter au panier"):not([disabled])').first().click();
  await p.waitForTimeout(1000);

  await p.goto(`${BASE}/panier`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  const cartText = await p.locator("main").innerText();
  const cartLines = cartText.split("\n").map((l) => l.trim()).filter(Boolean);

  check("the cart names a delivery line at all", /livraison/i.test(cartText));
  const cartTotal = money(cartLines[cartLines.findIndex((l) => /^total$/i.test(l)) + 1] ?? "");
  const cartSub = money(cartLines[cartLines.findIndex((l) => /^sous-total$/i.test(l)) + 1] ?? "");
  check("it shows a subtotal and a total", cartSub !== null && cartTotal !== null, `${cartSub} / ${cartTotal}`);
  // The whole bug in one assertion: the two used to be the same number.
  check("the total is not just the subtotal again", cartTotal > cartSub, `${cartSub} -> ${cartTotal}`);

  await p.goto(`${BASE}/commande`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1600);
  const coLines = (await p.locator("main").innerText()).split("\n").map((l) => l.trim()).filter(Boolean);
  const coTotal = money(coLines[coLines.lastIndexOf("Total") + 1] ?? "");
  check("checkout charges exactly what the cart quoted", coTotal === cartTotal, `cart ${cartTotal} vs checkout ${coTotal}`);
  await p.context().close();
}

/* ------------------------------------------------------------------ */
console.log("\n[2] NOTHING UNBUYABLE COMES BEFORE SOMETHING BUYABLE");
{
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

  // This test needs a family holding both a buyable part and an unbuyable one.
  //
  // It used to go looking for one, and skip every family that was not already
  // mixed — which made it depend on how much stock previous suites happened to
  // have bought. It passed for months on a half-sold database, and the moment
  // the battery started restoring stock before each run (see run-e2e.sh) every
  // family was uniformly in stock, nothing was mixed, and the check had
  // nothing at all to examine. A test that only runs when the data happens to
  // suit it is a test you cannot trust either way.
  //
  // So it builds the condition instead: empty the shelf on one part of one
  // family, assert, and put it back — on every path out.
  const families = await prisma.category.findMany({
    where: { parentId: null },
    select: { slug: true, name: true },
  });
  const emptied = [];
  const restoreStock = async () => {
    for (const { id, stockQty } of emptied.splice(0)) {
      await prisma.product.update({ where: { id }, data: { stockQty } }).catch(() => {});
    }
  };

  // A crash must not leave parts sitting at zero for every suite after this
  // one — the exact failure mode this section exists to guard against.
  process.on("uncaughtException", async (err) => {
    console.error(err);
    await restoreStock();
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });

  let checked = 0;
  for (const fam of families) {
    const inFamily = await prisma.product.findMany({
      where: { active: true, category: { OR: [{ slug: fam.slug }, { parent: { slug: fam.slug } }] } },
      orderBy: { stockQty: "asc" },
      select: { id: true, stockQty: true },
    });
    // Two parts at least, or "one comes before the other" says nothing.
    if (inFamily.length < 2) continue;

    // Take the least-stocked one off the shelf, unless one already is.
    const victim = inFamily[0];
    if (victim.stockQty > 0) {
      emptied.push({ id: victim.id, stockQty: victim.stockQty });
      await prisma.product.update({ where: { id: victim.id }, data: { stockQty: 0 } });
    }

    await p.goto(`${BASE}/catalogue/${fam.slug}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1100);
    const seq = await p.evaluate(() =>
      [...document.querySelectorAll('a[href^="/produit/"]')]
        .map((a) => a.closest("li,article,div[class*='rounded']") || a)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        // The card's own words, not "rupture" — that word is gone. A part
        // with nothing on the shelf now reads "Sur commande" (the shop orders
        // it in) or "Indisponible" (nobody can). Both are still parts that
        // should come after the ones on the shelf, and matching on "En stock"
        // is what keeps this check meaningful now that "rupture" would never
        // match anything and the assertion would pass trivially.
        // No \b around it: the card's text runs together as "…94.00 DTEn
        // stockLivraison…", so a word boundary before "En" never matches.
        .map((c) => (/En stock/i.test(c.textContent || "") ? "o" : "X"))
        .join(""),
    );
    // Sorted means every "o" precedes every "X".
    const tidy = seq === seq.split("").sort().reverse().join("");
    check(`${fam.name}: buyable parts lead`, tidy, seq);
    checked++;
  }
  check("at least one mixed family was there to check", checked > 0, `${checked} checked`);
  await restoreStock();
  await p.context().close();
}

/* ------------------------------------------------------------------ */
console.log("\n[3] AN UNPHOTOGRAPHED PART IS DRAWN, NOT ILLUSTRATED WITH SOMETHING ELSE");
{
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await p.goto(`${BASE}/catalogue/freinage`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);

  const srcs = await p.evaluate(() =>
    [...document.querySelectorAll('a[href^="/produit/"] img')].map((i) => i.getAttribute("src") || ""),
  );
  check("the cards have pictures", srcs.length > 0, `${srcs.length} images`);
  // The hero artwork is a photograph of engine oil and an air filter. On a
  // brake part it is not a missing picture, it is a wrong one.
  check(
    "none of them is the hero artwork",
    srcs.every((s) => !s.includes("parts-lineup")),
    srcs.find((s) => s.includes("parts-lineup")) ?? "",
  );
  check(
    "each one is drawn from its own family",
    srcs.every((s) => s.includes("/api/part-icon/") || s.includes("/api/images/")),
    srcs.slice(0, 2).join(" | "),
  );

  const icon = srcs.find((s) => s.includes("/api/part-icon/"));
  if (icon) {
    const res = await p.request.get(BASE + icon);
    check("the drawing is served", res.status() === 200, `HTTP ${res.status()}`);
    const body = await res.text();
    check("as an SVG that draws something", body.includes("<svg") && /<(path|circle|rect|ellipse)/.test(body));
    check("locked down like every other image route", (res.headers()["content-security-policy"] || "").includes("default-src 'none'"));
    // A subcategory has no drawing of its own and has to borrow its family's.
    const sub = await prisma.category.findFirst({ where: { parentId: { not: null } }, select: { slug: true } });
    const subRes = await p.request.get(`${BASE}/api/part-icon/${sub.slug}.svg`);
    check("a subcategory resolves up to its family", subRes.status() === 200, `HTTP ${subRes.status()}`);
  }
  await p.context().close();
}

/* ------------------------------------------------------------------ */
console.log("\n[4] THE PHONE GETS A SEARCH BOX IT CAN READ, AND A PAGE AT ITS OWN WIDTH");
{
  for (const width of [390, 414, 768]) {
    const p = await (await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 700, hasTouch: width < 700 })).newPage();
    await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);

    const fit = await p.evaluate(() => {
      const hero = document.querySelector("h1")?.closest("section");
      const input = hero?.querySelector("input[type='search']");
      if (!input) return null;
      const cs = getComputedStyle(input);
      const probe = document.createElement("span");
      probe.style.font = cs.font;
      probe.style.position = "absolute";
      probe.style.whiteSpace = "nowrap";
      probe.style.visibility = "hidden";
      probe.textContent = input.placeholder;
      document.body.appendChild(probe);
      const need = probe.offsetWidth;
      probe.remove();
      return { need: Math.round(need), have: Math.round(input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) };
    });
    check(`${width}px: the placeholder fits its box`, !!fit && fit.need <= fit.have, fit ? `needs ${fit.need}px, has ${fit.have}px` : "no hero input");

    // A phone grows its layout viewport to fit content that overflows, so a
    // row wider than the screen zooms the whole page out rather than showing
    // a scrollbar. Comparing scrollWidth to innerWidth cannot see that —
    // both grow together — so the device width is the thing to check.
    const inner = await p.evaluate(() => window.innerWidth);
    check(`${width}px: the page renders at the device width`, inner === width, `${inner}px`);
    await p.context().close();
  }

  // The swipe row has to actually swipe, or it is just a cut-off grid.
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  const strip = await p.evaluate(() => {
    const s = document.querySelector("#produits div[class*='overflow-x-auto']");
    return s ? { scrolls: s.scrollWidth > s.clientWidth + 1, w: Math.round(s.clientWidth) } : null;
  });
  check("the top-seller row scrolls sideways inside itself", !!strip && strip.scrolls, strip ? `${strip.w}px visible` : "no strip");
  await p.context().close();
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
