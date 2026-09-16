/**
 * Three things taken out, and one taken off the shopper's critical path.
 *
 *  - The review feature is gone. It had one control surface — the moderation
 *    queue — and nothing reached the storefront without it, so removing the
 *    queue alone would have left a public-writable surface with no way to
 *    publish and no way to take a post down. The table is dropped too.
 *  - The product page stated vehicle compatibility twice, in two components
 *    that each subscribed to the vehicle store and each shipped their own
 *    copy of the car picker. One panel now, and it no longer calls a part
 *    "ne correspond pas à votre véhicule" on the strength of having no data.
 *  - The category listing had no limit at all: every active part in the
 *    family, with its fitment ids joined on, rendered as cards and serialised
 *    into a client component. It is capped, with the rest a link away.
 *  - Two counters that read whole tables to produce small integers now count
 *    in Postgres.
 *
 * Run against a production build — see run-e2e.sh.
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { waitForAdmin } from "./lib/wait-for-admin.mjs";

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

/** Put a car in the garage without driving four dialog steps to get it there. */
const withVehicle = (v) => ({
  name: "apa-vehicle",
  value: JSON.stringify({ state: { vehicles: [v], vehicle: v }, version: 0 }),
  url: BASE,
});

/** Every source file under a directory, for whole-tree source checks. */
function collectSource(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectSource(full, out);
    else if (/\.(tsx?|mjs)$/.test(full)) out.push(full);
  }
  return out;
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const moved = [];

try {
  /* ------------------------------------------------------------- [1] ----- */
  console.log("\n[1] THE REVIEW FEATURE IS GONE, NOT JUST HIDDEN");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/compte`, { waitUntil: "domcontentloaded" });
    await p.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
    await p.fill('input[name="password"]', "admin1234");
    await p.getByRole("button", { name: "Se connecter", exact: true }).click();
    await waitForAdmin(p, BASE);

    const res = await p.request.get(`${BASE}/admin/avis`);
    check("the moderation queue is not a page any more", res.status() === 404, String(res.status()));

    await p.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(500);
    const nav = await p.locator("nav").first().innerText();
    check("and the admin menu does not point at it", !/avis/i.test(nav));
    check("no link to it anywhere in the admin", (await p.locator('a[href="/admin/avis"]').count()) === 0);

    // The table too: leaving it behind would be a schema nobody reads and a
    // migration somebody has to puzzle over later.
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Review'
    `;
    check("the Review table is dropped", tables.length === 0);
    await ctx.close();
  }

  /* ------------------------------------------------------------- [2] ----- */
  console.log("\n[2] THE PRODUCT PAGE STATES COMPATIBILITY ONCE");
  {
    // A part with real fitment data, and one of the engines it is listed for.
    const fitted = await prisma.product.findFirst({
      where: { active: true, fitments: { some: {} } },
      select: {
        slug: true,
        name: true,
        fitments: {
          take: 1,
          select: { engine: { select: { id: true, name: true, model: { select: { id: true, name: true, make: true } } } } },
        },
      },
    });
    const e = fitted.fitments[0].engine;
    const car = {
      makeId: e.model.make.id,
      makeName: e.model.make.name,
      modelId: e.model.id,
      modelName: e.model.name,
      engineId: e.id,
      engineName: e.name,
    };

    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.addCookies([]);
    await ctx.addInitScript((entry) => {
      try { localStorage.setItem(entry.name, entry.value); } catch {}
    }, withVehicle(car));
    const p = await ctx.newPage();
    await p.goto(`${BASE}/produit/${fitted.slug}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(900);

    const main = await p.locator("main").innerText();
    check("the car is recognised", /correspond à votre véhicule/i.test(main), car.makeName + " " + car.modelName);

    // The duplicate said the same thing in different words, right above it.
    check("the second panel is gone", !/Compatibilité vérifiée dans notre base/i.test(main));
    check("and its change-vehicle link with it", !/Changer de véhicule/i.test(main));

    const verdicts = (main.match(/correspond à votre véhicule/gi) || []).length;
    check("the verdict appears exactly once", verdicts === 1, `${verdicts} time(s)`);
    const changers = await p.getByRole("button", { name: /^changer$/i }).count();
    check("with one way to change the car", changers === 1, `${changers} control(s)`);
    await ctx.close();
  }

  /* ------------------------------------------------------------- [3] ----- */
  console.log("\n[3] «NO DATA» IS NOT «DOES NOT FIT»");
  {
    // The bug this replaces: a part the shop has recorded no compatibility for
    // was shown to every shopper with a saved car as "ne correspond pas à
    // votre véhicule" — a claim about the part, made from the absence of data.
    const bare = await prisma.product.findFirst({
      where: { active: true, fitments: { none: {} } },
      select: { slug: true, name: true },
    });
    const anyEngine = await prisma.vehicleEngine.findFirst({
      select: { id: true, name: true, model: { select: { id: true, name: true, make: true } } },
    });

    if (!bare) {
      check("a part with no fitment data exists to check (skipped: none)", true);
    } else {
      const car = {
        makeId: anyEngine.model.make.id,
        makeName: anyEngine.model.make.name,
        modelId: anyEngine.model.id,
        modelName: anyEngine.model.name,
        engineId: anyEngine.id,
        engineName: anyEngine.name,
      };
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await ctx.addInitScript((entry) => {
        try { localStorage.setItem(entry.name, entry.value); } catch {}
      }, withVehicle(car));
      const p = await ctx.newPage();
      await p.goto(`${BASE}/produit/${bare.slug}`, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(900);
      // Only this part's own panel. Further down the page, "Produits
      // similaires" cards legitimately say a *different* part does not fit —
      // that is them getting it right, not this getting it wrong.
      const main = await p.locator("main").innerText();
      const panel = main.split(/DESCRIPTION/i)[0];

      check("it is not called incompatible", !/ne correspond pas/i.test(panel), bare.slug);
      check("it says the compatibility is unknown", /à confirmer/i.test(panel));
      check("and offers to have it checked", /faire vérifier/i.test(panel));
      await ctx.close();
    }
  }

  /* ------------------------------------------------------------- [4] ----- */
  console.log("\n[4] THE POSITION SURVIVED THE MOVE TO THE SERVER");
  {
    let positioned = await prisma.product.findFirst({
      where: { active: true, OR: [{ axle: { not: null } }, { side: { not: null } }] },
      select: { slug: true, axle: true, side: true },
    });
    // No part in this catalogue has a position recorded, so one is given one
    // for the duration and put back — the badges are worth a check, and a
    // permanently skipped assertion is not a check.
    let borrowed = null;
    if (!positioned) {
      const victim = await prisma.product.findFirst({ where: { active: true }, select: { id: true, slug: true } });
      borrowed = victim;
      await prisma.product.update({ where: { id: victim.id }, data: { axle: "AVANT", side: "GAUCHE" } });
      positioned = { slug: victim.slug, axle: "AVANT", side: "GAUCHE" };
    }
    if (!positioned) {
      check("a positioned part exists to check (skipped: none)", true);
    } else {
      // Fetched as HTML, with no JavaScript run at all: the badges used to
      // live inside a client component and are plain server output now.
      const html = await (await fetch(`${BASE}/produit/${positioned.slug}`)).text();
      const expected = positioned.axle === "AVANT" ? "Avant" : positioned.axle === "ARRIERE" ? "Arrière" : null;
      check("front/rear is in the HTML itself", expected ? html.includes(expected) : true,
            `${positioned.axle ?? "—"}/${positioned.side ?? "—"}`);
      check("under the label it belongs to", html.includes("Position"));
      check("and left/right too", html.includes("Gauche") || positioned.side === null);
    }
    if (borrowed) {
      await prisma.product.update({ where: { id: borrowed.id }, data: { axle: null, side: null } });
    }
  }

  /* ------------------------------------------------------------- [5] ----- */
  console.log("\n[5] THE AISLE IS BOUNDED, AND THE REST IS A LINK AWAY");
  {
    // The catalogue holds fewer parts than the page size, so the cap cannot be
    // exercised as the shop stands. Every part is filed into one subcategory
    // for the duration and put back afterwards — the same trick e2e-catalog-
    // admin uses, and the only honest way to test a limit on a small shop.
    const target = await prisma.category.findFirst({
      where: { parentId: { not: null } },
      select: { id: true, slug: true, parent: { select: { slug: true } } },
    });
    const all = await prisma.product.findMany({
      where: { active: true },
      select: { id: true, categoryId: true },
    });
    for (const p of all) moved.push(p);
    await prisma.product.updateMany({
      where: { id: { in: all.map((p) => p.id) } },
      data: { categoryId: target.id },
    });

    const total = all.length;
    const PAGE = 48;
    const familyUrl = `${BASE}/catalogue/${target.parent.slug}`;

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
    const p = await ctx.newPage();
    await p.goto(familyUrl, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1200);

    // Distinct parts, not anchors: a card links to the same product from its
    // picture and from its name.
    const cards = async () =>
      new Set(
        await p.locator("main a[href^='/produit/']").evaluateAll((els) =>
          els.map((e) => e.getAttribute("href"))),
      ).size;
    const first = await cards();
    check("a family larger than a page hands over one page", first <= PAGE && first > 0,
          `${first} card(s) of ${total}`);

    const more = p.getByRole("link", { name: /voir plus de pièces/i });
    check("with a link to the rest", (await more.count()) === 1);
    const body = await p.locator("main").innerText();
    check("and it says how many there are", new RegExp(`${first} sur ${total}`).test(body),
          body.split("\n").find((l) => /sur \d+/.test(l)) ?? "");

    // In-stock first has to survive the cap: it was a JavaScript sort over the
    // whole result set, which is exactly what a limit breaks if it is left
    // there. Nothing unbuyable may appear before something buyable.
    const stocked = await prisma.product.count({ where: { active: true, stockQty: { gt: 0 } } });
    const firstPageOrder = [
      ...new Set(
        await p.locator("main a[href^='/produit/']").evaluateAll((els) =>
          els.map((e) => e.getAttribute("href").replace("/produit/", ""))),
      ),
    ];
    const slugsInStock = new Set(
      (await prisma.product.findMany({ where: { active: true, stockQty: { gt: 0 } }, select: { slug: true } }))
        .map((r) => r.slug));
    const seenOut = firstPageOrder.findIndex((s) => !slugsInStock.has(s));
    const lastIn = firstPageOrder.reduce((last, s, i) => (slugsInStock.has(s) ? i : last), -1);
    check("what can be bought still comes first, inside the page",
          seenOut === -1 || lastIn < seenOut,
          `${stocked} in stock; first out-of-stock at ${seenOut}, last in-stock at ${lastIn}`);

    await more.click();
    await p.waitForTimeout(1200);
    const second = await cards();
    check("the link brings the rest", second === total, `${second} of ${total}`);
    check("and then stops offering more",
          (await p.getByRole("link", { name: /voir plus de pièces/i }).count()) === 0);

    // A crafted URL must not be able to ask for the whole table.
    await p.goto(`${familyUrl}?n=999999`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1200);
    const crafted = await cards();
    check("a hand-typed n= is clamped, not obeyed", crafted <= 480, `${crafted} card(s)`);
    await ctx.close();
  }

  /* ------------------------------------------------------------- [6] ----- */
  console.log("\n[6] COUNTERS COUNT IN POSTGRES, NOT IN NODE");
  {
    // Source-level, because the symptom only shows at a size this shop has not
    // reached: both of these produced one small integer per row of output and
    // read an entire table to do it. Comments are stripped first — the prose
    // describing the old shape would otherwise match the pattern it describes.
    const src = readFileSync("src/lib/data/catalog.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/.*$/gm, "");

    const brandsFn = src.slice(src.indexOf("getBrandsForCategory = cache"), src.indexOf("getProductBySlug ="));
    check("the brand sidebar no longer reads every product in the family",
          !/product\.findMany/.test(brandsFn) && /COUNT\(\*\)/.test(brandsFn));

    const makesFn = src.slice(src.indexOf("getVehicleMakes = cache"), src.indexOf("getActivePromotions"));
    check("the car picker no longer reads the whole fitment table",
          !/productFitment\.findMany/.test(makesFn) && /COUNT\(DISTINCT p\.id\)/.test(makesFn));

    const listFn = src.slice(src.indexOf("export async function getProductsForCategory"),
                             src.indexOf("export const getCategoryFacets"));
    const finds = (listFn.match(/product\.findMany/g) || []).length;
    const takes = (listFn.match(/\btake\b/g) || []).length;
    check("every listing read carries a limit", finds > 0 && takes >= finds,
          `${finds} read(s), ${takes} mention(s) of take`);

    // All three languages ship in the bundle on purpose — measured, and
    // cheaper than sending the active one down with every page — which is
    // exactly why a string nobody renders is not free. 116 of 435 keys had
    // outlived their screens; this keeps the table honest as pages change.
    const dict = readFileSync("src/i18n/dictionaries.ts", "utf8");
    const keys = [...new Set([...dict.matchAll(/^\s{4}"([a-zA-Z0-9_.]+)":/gm)].map((m) => m[1]))];
    const code = collectSource("src").filter((f) => !f.endsWith("dictionaries.ts"))
      .map((f) => readFileSync(f, "utf8")).join("\n");
    const unused = keys.filter((k) => {
      if (code.includes(`"${k}"`) || code.includes(`'${k}'`)) return false;
      // <T k={`trust.title${n}`} /> — a family of keys built from an index.
      const family = k.replace(/\d+$/, "");
      return family === k || !code.includes(`\`${family}\${`);
    });
    check("no dictionary key outlives the screen that used it",
          unused.length === 0, `${keys.length} keys, ${unused.length} unused: ${unused.slice(0, 6).join(", ")}`);
  }

  /* ------------------------------------------------------------- [7] ----- */
  console.log("\n[7] AND THE PAGES STILL WORK");
  {
    for (const path of ["/", "/catalogue/freinage", "/recherche?q=frein", "/panier", "/contact"]) {
      const res = await fetch(BASE + path);
      check(`${path} still renders`, res.status === 200, String(res.status));
    }
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(BASE, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1200);
    await p.getByRole("button", { name: /^choisir ma voiture$/i }).first().click();
    await p.waitForTimeout(900);
    check("the car picker still opens", (await p.locator('[role="dialog"]').count()) === 1);
    check("with the makes it counted", /pièce/i.test(await p.locator('[role="dialog"]').innerText()) ||
          /je connais ma voiture/i.test(await p.locator('[role="dialog"]').innerText()));
    check("and no page threw", errors.length === 0, errors.slice(0, 2).join(" | "));
    await ctx.close();
  }
} catch (err) {
  fail++;
  console.log(`  FAIL  the suite threw — ${err?.message ?? err}`);
  console.log(String(err?.stack ?? "").split("\n").slice(1, 4).join("\n"));
} finally {
  // Put every part back where it was filed — and then tell the storefront.
  //
  // The moves above went straight to the database, so nothing invalidated the
  // cached category tree that draws the navigation and the family board. The
  // suite that runs next then reads a tree in which one subcategory holds the
  // entire catalogue and reports it as a bug in the navigation. Saving one
  // product through the admin form calls the same revalidation an ordinary
  // edit does, which is the shop's own way of refreshing the storefront.
  for (const p of moved) {
    await prisma.product.update({ where: { id: p.id }, data: { categoryId: p.categoryId } }).catch(() => {});
  }
  if (moved.length > 0) {
    try {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
      const p = await ctx.newPage();
      await p.goto(`${BASE}/compte`, { waitUntil: "domcontentloaded" });
      await p.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
      await p.fill('input[name="password"]', "admin1234");
      await p.getByRole("button", { name: "Se connecter", exact: true }).click();
      await waitForAdmin(p, BASE);
      await p.goto(`${BASE}/admin/stock/${moved[0].id}`, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(1200);
      await p.getByRole("button", { name: "Enregistrer" }).first().click();
      await p.waitForTimeout(2500);
      await ctx.close();
    } catch {
      // Best effort: a failed refresh must not turn a green suite red.
    }
  }
  await browser.close();
  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
