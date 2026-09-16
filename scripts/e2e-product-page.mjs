/**
 * The product page, rebuilt around the product.
 *
 * The complaint: the image was too big and trapped in a generic rectangular
 * box, the brand had no identity and no link, photography backgrounds were
 * inconsistent, and the page gave technical text more room than the thing
 * being sold. Underneath it were two facts nobody had written down — the
 * gallery was cropping every photo it was given, and the shop's own answer to
 * an empty shelf ("Rupture de stock", buy button removed) was wrong for a shop
 * that orders most of its catalogue in.
 *
 * Every section here pins one of those down so it cannot come back.
 *
 * Run against a production build — see run-e2e.sh.
 */
import { readFileSync } from "node:fs";
import { chromium, devices } from "playwright";
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

// A part with a maker and some recorded compatibility — the page at its
// fullest, so nothing below is passing because a section was absent.
//
// Deliberately NOT filtered on stock. This asked for `stockQty > 2` at first
// and crashed when the whole battery ran: ~25 real orders go through before
// this suite starts, nothing puts the stock back, and by then no part with a
// brand *and* fitments had three left. It is also the wrong constraint now —
// a part with an empty shelf is still buyable, because the shop orders it in.
// `orderBy` prefers a stocked one when there is one, and the suite works
// either way. (See the note in HANDOVER §2: never over-constrain the thing
// you are about to buy.)
const rich = await prisma.product.findFirst({
  where: { active: true, brandId: { not: null }, fitments: { some: {} } },
  orderBy: { stockQty: "desc" },
  select: { slug: true, name: true, sku: true, brand: { select: { name: true, slug: true } } },
});
if (!rich) {
  console.log("  SKIP  no active part has both a brand and recorded fitment — nothing to test");
  await browser.close();
  await prisma.$disconnect();
  process.exit(0);
}

// Something with nothing on the shelf. There nearly always is one by now, but
// a fresh database is all stock, so fall back to emptying the least-stocked
// part — and put it back at the end, on every path out.
let empty = await prisma.product.findFirst({
  where: { active: true, stockQty: { lte: 0 } },
  select: { slug: true, name: true, id: true, supply: true },
});
let restoreStock = null;
if (!empty) {
  const lowest = await prisma.product.findFirst({
    where: { active: true },
    orderBy: { stockQty: "asc" },
    select: { slug: true, name: true, id: true, supply: true, stockQty: true },
  });
  restoreStock = { id: lowest.id, stockQty: lowest.stockQty };
  await prisma.product.update({ where: { id: lowest.id }, data: { stockQty: 0 } });
  empty = lowest;
}

/** Put back anything this suite moved — see HANDOVER §2. */
async function restoreShared() {
  if (restoreStock) {
    await prisma.product
      .update({ where: { id: restoreStock.id }, data: { stockQty: restoreStock.stockQty } })
      .catch(() => {});
    restoreStock = null;
  }
  // The supply mode is flipped in [4] and [5]; if either threw part-way it is
  // left on whatever it was set to, so put it back here too.
  await prisma.product
    .update({ where: { id: empty.id }, data: { supply: empty.supply } })
    .catch(() => {});
}

// A crash must not leave a part out of stock, or marked unsupplyable, for
// every suite that runs after this one.
process.on("uncaughtException", async (err) => {
  console.error(err);
  await restoreShared();
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

/* --------------------------------------------------------------- [1] ----- */
console.log("\n[1] WHAT A PHONE SEES FIRST, IN THE ORDER IT WAS ASKED FOR");
{
  const ctx = await browser.newContext({ ...devices["iPhone 14"] });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/produit/${rich.slug}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(700);

  const y = await p.evaluate(() => {
    const at = (el) => (el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null);
    return {
      brand: at(document.querySelector('a[href^="/marque/"]')),
      image: at(document.querySelector('[role="group"] img')),
      name: at(document.querySelector("h1")),
      compat: at([...document.querySelectorAll("p")].find((e) => /Compatible avec/i.test(e.textContent || ""))),
      price: at([...document.querySelectorAll("*")].find((e) => e.children.length === 0 && /^\d+[.,]\d{2}\s*DT$/.test((e.textContent || "").trim()))),
      avail: at([...document.querySelectorAll("span")].find((e) => /^(En stock|Disponible sur commande|Indisponible)$/.test((e.textContent || "").trim()))),
      cta: at([...document.querySelectorAll("button")].find((e) => /Ajouter au panier/i.test(e.textContent || ""))),
      vh: window.innerHeight,
    };
  });

  const order = ["brand", "image", "name", "compat", "price", "avail", "cta"];
  for (const k of order) check(`${k} is on the page`, y[k] !== null, y[k] === null ? "missing" : `y=${y[k]}`);

  const seq = order.map((k) => y[k]).filter((v) => v !== null);
  const sorted = seq.every((v, i) => i === 0 || v >= seq[i - 1]);
  check("and they appear in that order, top to bottom", sorted, seq.join(" → "));

  // Six of the seven fit; the button is the one that cannot, because the site
  // header takes 214px before the page starts. The sticky bar exists for
  // exactly that, and [3] checks it is up whenever the button is not.
  check(
    "everything but the button is above the fold",
    y.avail !== null && y.avail < y.vh,
    `availability at ${y.avail} of ${y.vh}px`,
  );
  await ctx.close();
}

/* --------------------------------------------------------------- [2] ----- */
console.log("\n[2] THE PICTURE IS NOT CROPPED, AND NOT IN A BOX INSIDE A BOX");
{
  const ctx = await browser.newContext({ ...devices["iPhone 14"] });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/produit/${rich.slug}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(700);

  const g = await p.evaluate(() => {
    const img = document.querySelector('[role="group"] img');
    const track = document.querySelector('[role="group"]');
    const s = getComputedStyle(img);
    return {
      fit: s.objectFit,
      h: Math.round(img.getBoundingClientRect().height),
      snap: getComputedStyle(track).scrollSnapType,
      overflow: getComputedStyle(track).overflowX,
    };
  });
  // object-cover cut the ends off every landscape photo the shop uploads, and
  // on a wiper blade or a hose the shape is the product.
  check("the whole part is shown, never a crop of it", g.fit === "contain", g.fit);
  check("the picture leaves room for the rest of the page", g.h <= 260, `${g.h}px`);
  check("and it swipes", g.snap.includes("x") && g.overflow === "auto", `${g.snap} / ${g.overflow}`);

  // The placeholder drawing used to paint its own pale square, which sat
  // inside the page's plate — a box in a box, which is what the complaint was.
  const svg = await (await fetch(`${BASE}/api/part-icon/freinage.svg`)).text();
  check("the stand-in drawing paints no background of its own", !/<rect[^>]*fill=/i.test(svg));
  await ctx.close();
}

/* --------------------------------------------------------------- [3] ----- */
console.log("\n[3] THE BUY BUTTON IS NEVER OUT OF REACH");
{
  const ctx = await browser.newContext({ ...devices["iPhone 14"] });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/produit/${rich.slug}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(700);

  const bar = () =>
    p.evaluate(() => {
      const el = [...document.querySelectorAll("div")].find(
        (d) => getComputedStyle(d).position === "fixed" && d.className.includes("bottom-0") && /Ajouter/.test(d.textContent || ""),
      );
      if (!el) return "absent";
      return el.getBoundingClientRect().top < window.innerHeight - 10 ? "shown" : "hidden";
    });
  const ctaY = await p.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((e) => /Ajouter au panier/i.test(e.textContent || ""));
    return Math.round(b.getBoundingClientRect().top + window.scrollY);
  });

  check("the bar is up while the button is off screen", (await bar()) === "shown");
  await p.evaluate((y) => window.scrollTo(0, y - 200), ctaY);
  await p.waitForTimeout(500);
  check("and gets out of the way once the button is in view", (await bar()) === "hidden");
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.7));
  await p.waitForTimeout(500);
  check("and comes back when it scrolls away again", (await bar()) === "shown");

  // The purchase block has exactly one button, and the sticky bar is not a
  // second one carrying the same words: the bar says "Ajouter". (The related
  // products further down have their own buttons — those are other parts.)
  const n = await p.locator('#acheter button:has-text("Ajouter au panier")').count();
  check("the purchase block has one buy button", n === 1, `${n} found`);
  const barLabel = await p.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find(
      (d) => getComputedStyle(d).position === "fixed" && d.className.includes("bottom-0") && /Ajouter/.test(d.textContent || ""),
    );
    return el?.querySelector("button")?.textContent?.trim() ?? "";
  });
  check("and the bar does not repeat its words", barLabel === "Ajouter", `"${barLabel}"`);
  await ctx.close();
}

/* --------------------------------------------------------------- [4] ----- */
console.log("\n[4] AN EMPTY SHELF IS A DELAY, NOT A REFUSAL");
{
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();

  // ON_ORDER — what nearly every part in this catalogue is.
  await prisma.product.update({ where: { id: empty.id }, data: { supply: "ON_ORDER" } });
  await p.goto(`${BASE}/produit/${empty.slug}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(700);
  let body = await p.locator("main, body").first().innerText();
  check("a part with nothing on the shelf says it can be ordered", /Disponible sur commande/i.test(body));
  check("and the word 'rupture' is gone from it", !/rupture/i.test(body));
  check("and it can still be bought", (await p.locator('#acheter button:has-text("Ajouter au panier")').count()) === 1);

  // UNAVAILABLE — the one case that really is a refusal.
  await prisma.product.update({ where: { id: empty.id }, data: { supply: "UNAVAILABLE" } });
  await p.goto(`${BASE}/produit/${empty.slug}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(700);
  body = await p.locator("main, body").first().innerText();
  check("a part nobody supplies says so", /Indisponible/i.test(body));
  check("and offers no button", (await p.locator('#acheter button:has-text("Ajouter au panier")').count()) === 0);

  await prisma.product.update({ where: { id: empty.id }, data: { supply: empty.supply } });
  await p.context().close();
}

/* --------------------------------------------------------------- [5] ----- */
console.log("\n[5] ORDERING A PART THE SHOP HAS TO FETCH");
{
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await prisma.product.update({ where: { id: empty.id }, data: { supply: "ON_ORDER" } });
  await p.goto(`${BASE}/produit/${empty.slug}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(700);
  await p.locator('#acheter button:has-text("Ajouter au panier")').click();
  await p.waitForTimeout(600);

  await p.goto(`${BASE}/commande`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(700);
  await p.locator('input[autocomplete="name"]').fill("QA Sur Commande");
  await p.locator('input[type="tel"]').fill("20444333");
  await p.locator('input[autocomplete="street-address"]').fill("2 rue du Fournisseur");
  await p.getByRole("button", { name: /Confirmer la commande/i }).click();
  const ok = await p
    .waitForURL(/\/commande\/confirmation\//, { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  check("the order goes through", ok, ok ? p.url().split("/").pop() : "refused");

  if (ok) {
    const ref = p.url().split("/").pop();
    const order = await prisma.order.findUnique({
      where: { ref },
      select: { id: true, items: { select: { backorder: true, productId: true } } },
    });
    const line = order?.items.find((i) => i.productId === empty.id);
    // The picking bench has to know before it starts, not when it reaches an
    // empty shelf.
    check("and the line is marked as one to fetch", line?.backorder === true, String(line?.backorder));

    const stock = await prisma.product.findUnique({ where: { id: empty.id }, select: { stockQty: true } });
    check("selling from an empty shelf never drives stock negative", stock.stockQty >= 0, `${stock.stockQty}`);

    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.orderStatusEvent.deleteMany({ where: { orderId: order.id } }).catch(() => {});
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
  }
  await prisma.product.update({ where: { id: empty.id }, data: { supply: empty.supply } });
  await p.context().close();
}

/* --------------------------------------------------------------- [6] ----- */
console.log("\n[6] THE MAKER HAS A NAME, A MARK AND A PAGE");
{
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await p.goto(`${BASE}/produit/${rich.slug}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(600);

  const href = await p.locator('a[href^="/marque/"]').first().getAttribute("href");
  check("the brand block links to the brand", href === `/marque/${rich.brand.slug}`, String(href));

  await p.locator('a[href^="/marque/"]').first().click();
  await p.waitForURL(/\/marque\//, { timeout: 15000 });
  await p.waitForTimeout(700);
  const brandBody = await p.locator("main, body").first().innerText();
  check("and that page is about the maker", new RegExp(rich.brand.name, "i").test(brandBody));
  check("it says how many references it holds", /référence/i.test(brandBody));
  check("and it lists parts", (await p.locator('a[href^="/produit/"]').count()) > 0);

  // A brand with nothing live behind it is not a page.
  const orphan = await prisma.brand.findFirst({
    where: { products: { none: { active: true } } },
    select: { slug: true },
  });
  if (orphan) {
    const res = await fetch(`${BASE}/marque/${orphan.slug}`);
    check("a brand with no live part has no page", res.status === 404, `HTTP ${res.status}`);
  } else {
    check("a brand with no live part has no page", true, "(every brand has parts — nothing to check)");
  }

  const idx = await fetch(`${BASE}/marques`);
  check("the index the header points at exists", idx.status === 200, `HTTP ${idx.status}`);
  await p.context().close();
}

/* --------------------------------------------------------------- [7] ----- */
console.log("\n[7] TECHNICAL INFORMATION IS AVAILABLE, NOT IMPOSED");
{
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await p.goto(`${BASE}/produit/${rich.slug}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(600);

  const heading = await p.locator("h2", { hasText: /Informations techniques/i }).count();
  check("there is a technical section", heading === 1);

  // Progressive disclosure, and it is a <details> — so it costs no JavaScript
  // and opens for a reader who has none.
  const details = await p.locator("#technique details").count();
  const openByDefault = await p.evaluate(
    () => [...document.querySelectorAll("#technique details")].filter((d) => d.open).length,
  );
  check("anything beyond the identity rows is folded away", details === 0 || openByDefault === 0, `${details} disclosure(s)`);

  const rows = await p.locator("#technique dt").allInnerTexts();
  check("the identity rows are named, not numbered", rows.includes("Référence"), rows.join(" · "));
  check("and the warranty is one of them", rows.includes("Garantie"));

  // The description comes before the specification sheet, which is the whole
  // point of the reordering.
  const order = await p.evaluate(() => {
    const at = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect().top + window.scrollY : Infinity;
    };
    return { description: at("#description"), technique: at("#technique") };
  });
  check("the description leads and the specifications follow", order.description < order.technique);
  await p.context().close();
}

/* --------------------------------------------------------------- [8] ----- */
console.log("\n[8] WHAT THE SOURCE MUST AND MUST NOT SAY");
{
  const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

  const related = read("src/lib/data/catalog.ts");
  // Without `category` in the include, serializeProduct cannot swap the seeded
  // hero artwork for the family drawing — and the related row showed a wiper
  // blade illustrated with a photograph of engine oil and a spark plug.
  const block = related.slice(related.indexOf("getRelatedProducts"), related.indexOf("getTopSellers"));
  check("related products are asked for their category", /category:\s*true/.test(block));

  const gallery = read("src/components/ProductGallery.tsx");
  // Matched inside a className, not anywhere in the file: the comment at the
  // top of that component names object-cover in order to explain what it
  // replaced, and a bare substring test reads that as the bug still being
  // present.
  check(
    "the gallery contains, never covers",
    gallery.includes("object-contain") && !/className="[^"]*object-cover/.test(gallery),
  );

  const availability = read("src/lib/availability.ts");
  check("a delay is only ever quoted when the shop has set one", availability.includes("leadTime?.trim() || null"));

  const orders = read("src/app/actions/orders.ts");
  check(
    "only an unsupplyable part refuses an order",
    /supply === "UNAVAILABLE"/.test(orders) && !/Stock insuffisant/.test(orders),
  );

  const settings = read("src/app/actions/admin.ts");
  // The hand-kept list went stale once already and swallowed shop_tax_id.
  check("the settings the form may write are derived, not listed", settings.includes("Object.keys(DEFAULT_SETTINGS)"));
}

await browser.close();
await restoreShared();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
