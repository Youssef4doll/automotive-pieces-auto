/**
 * TVA and droit de timbre — the money, and where it is allowed to change.
 *
 * Two rules are defended here, and they pull against each other, which is why
 * this is a suite rather than a glance at a page:
 *
 *  1. The catalogue quotes TTC. So the TVA line on a facture decomposes money
 *     already counted; it must never add to a total. The lines of the block
 *     have to sum to the stored total to the millime, and the stored total
 *     has to be what the shopper was shown before they committed.
 *
 *  2. The timbre fiscal is the opposite — a real extra dinar. So it MUST move
 *     the total, which means it has to be quoted from the cart onwards. A
 *     total that grows at the last step is the behaviour lib/shipping.ts
 *     exists to stop, and adding a tax was the obvious way to bring it back.
 *
 * And one rule outranking both: an order already placed is a fact. Switching
 * TVA on today must not restate a document filed last month. Section [5]
 * checks exactly that, against an order placed while the shop was untaxed.
 *
 * The settings are put back as they were found — the rest of the battery
 * reads them too.
 *
 * Driven against a production build. See run-e2e.sh for why not `next dev`.
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
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

// The storefront writes "21.20 DT" (formatTND) and the account area and the
// printed document write "21,20 DT" (formatTNDfr). Both are read here rather
// than picking one: this suite follows a single order from the cart through
// to the paper, and would otherwise go blind halfway along.
const MONEY_SRC = "-?\\d[\\d\\s\\u00a0\\u202f]*[.,]\\d{2}\\s?DT";

/** "62,10 DT" → 62.1, so figures on a page can be added up. */
const dt = (s) => Number(String(s).replace(/[\s  ]|DT/g, "").replace(",", "."));

/** Every amount inside an element, in order. */
async function amounts(scope) {
  const text = await scope.textContent();
  return (text.match(new RegExp(MONEY_SRC, "g")) || []).map(dt);
}

/**
 * The figure printed beside a label, inside one totals block.
 *
 * Anchored at the start of the row's text: "Total" is a prefix of exactly one
 * line but a substring of several, and matching it loosely picks up the
 * line-items table's "Total" column header, which holds no amount at all and
 * reads back as a missing figure.
 */
async function lineValue(scope, label) {
  const row = scope
    .locator("tr, dl > div, div")
    .filter({ hasText: new RegExp(`^\\s*${label}`) })
    .last();
  if ((await row.count()) === 0) return null;
  const m = (await row.textContent()).match(new RegExp(MONEY_SRC));
  return m ? dt(m[0]) : null;
}

/** The totals block of a printed document — the last table on the page. */
const totalsTable = (page) => page.locator("article table").last();

const settingValue = async (key) => (await prisma.setting.findUnique({ where: { key } }))?.value ?? null;

const before = {
  shop_tax_id: await settingValue("shop_tax_id"),
  vat_rate: await settingValue("vat_rate"),
  stamp_duty: await settingValue("stamp_duty"),
};

async function setSetting(key, value) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function placeOrder(page, name) {
  await page.goto(`${BASE}/catalogue/filtres`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  await page.click('button:has-text("Ajouter au panier")');
  await page.waitForTimeout(700);
  await page.goto(`${BASE}/commande`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await page.locator('input[autocomplete="name"]').first().fill(name);
  await page.locator('input[autocomplete="tel"]').first().fill("20111333");
  await page.click('button:has-text("Ariana")');
  await page.waitForTimeout(250);
  await page.locator('[autocomplete="street-address"]').first().fill("12 avenue de Carthage");
  await page.click('button:has-text("Confirmer la commande")');
  await page.waitForURL(/confirmation/, { timeout: 30000 });
  return page.url().split("/").pop();
}

/* --------------------------------------------------------------- [1] ----- */

console.log("\n[1] WITH NO MATRICULE FISCAL, NOTHING CHANGES AT ALL");
await setSetting("shop_tax_id", "");
await setSetting("vat_rate", "19");
await setSetting("stamp_duty", "1.000");

const untaxedCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const untaxed = await untaxedCtx.newPage();
let untaxedRef = null;
{
  // A rate and a stamp are sitting in the settings; the matricule is not. A
  // trader without one cannot charge la TVA, so both must read as zero
  // however they happen to be filled in.
  untaxedRef = await placeOrder(untaxed, "Client Reçu");
  const order = await prisma.order.findUnique({
    where: { ref: untaxedRef },
    select: { subtotal: true, shippingFee: true, total: true, vatRate: true, stampDuty: true },
  });
  const n = (d) => Number(d);
  check(
    "the order carries no rate and no stamp",
    n(order.vatRate) === 0 && n(order.stampDuty) === 0,
    `taux ${n(order.vatRate)} · timbre ${n(order.stampDuty)}`
  );
  check(
    "its total is still exactly parts + livraison",
    Math.abs(n(order.total) - (n(order.subtotal) + n(order.shippingFee))) < 0.005,
    `${n(order.subtotal)} + ${n(order.shippingFee)} = ${n(order.total)}`
  );

  await untaxed.goto(`${BASE}/commande/${untaxedRef}/recu`, { waitUntil: "domcontentloaded" });
  const body = await untaxed.textContent("article");
  check("the document is a reçu, not a facture", /Reçu/.test(body) && !/Facture/.test(body));
  check("no TVA line is printed", !/TVA/.test(body));
  check("no timbre fiscal line is printed", !/[Tt]imbre/.test(body));
  check("the sous-total is not relabelled HT", /Sous-total/.test(body) && !/Sous-total HT/.test(body));
  check("nor the total TTC", /Total/.test(body) && !/Total TTC/.test(body));
}

/* --------------------------------------------------------------- [2] ----- */

console.log("\n[2] THE MATRICULE IS SAVED BY THE FORM THAT ASKS FOR IT");
// Kept open past this section: [6] reads the admin's own view of the order,
// and that needs a signed-in admin.
const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const admin = await adminCtx.newPage();
{
  // It was not: shop_tax_id had a field on /admin/parametres and was missing
  // from the action's allow-list, so every matricule ever typed into it was
  // silently dropped and the printable document could never become a facture
  // however many times somebody filled it in.
  await admin.goto(`${BASE}/compte`);
  await admin.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
  await admin.fill('input[name="password"]', "admin1234");
  await admin.getByRole("button", { name: "Se connecter", exact: true }).click();
  await waitForAdmin(admin, BASE);

  await admin.goto(`${BASE}/admin/parametres`, { waitUntil: "domcontentloaded" });
  await admin.fill('input[name="shop_tax_id"]', "1234567/A/M/000");
  await admin.fill('input[name="vat_rate"]', "19");
  await admin.fill('input[name="stamp_duty"]', "1.000");
  await admin.click('button:has-text("Enregistrer")');
  await admin.waitForTimeout(900);

  check(
    "the matricule reaches the database",
    (await settingValue("shop_tax_id")) === "1234567/A/M/000",
    String(await settingValue("shop_tax_id"))
  );
  check("so does the rate", (await settingValue("vat_rate")) === "19");
  check("so does the timbre", (await settingValue("stamp_duty")) === "1.000");
}

/* --------------------------------------------------------------- [3] ----- */

console.log("\n[3] THE TIMBRE IS QUOTED BEFORE IT IS CHARGED, NEVER AFTER");
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
let cartTotal = null;
let checkoutTotal = null;
{
  await p.goto(`${BASE}/catalogue/filtres`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(600);
  await p.click('button:has-text("Ajouter au panier")');
  await p.waitForTimeout(700);

  await p.goto(`${BASE}/panier`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(700);
  // The box carrying the checkout link — the cart's own totals, not the line
  // items above them.
  const cartBox = p.locator('main div:has(> a[href="/commande"])').last();
  check("the cart names the timbre fiscal", /Timbre fiscal/.test(await cartBox.textContent()));
  const cartStamp = await lineValue(cartBox, "Timbre fiscal");
  check("at one dinar", cartStamp === 1, `${cartStamp} DT`);
  cartTotal = await lineValue(cartBox, "Total");

  await p.goto(`${BASE}/commande`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(700);
  // Scoped to the form that places the order: the header carries a search
  // form, and a bare `form` selector reads that one instead.
  const summary = p.locator('form:has(button:has-text("Confirmer la commande"))');
  check("the checkout summary names it too", /Timbre fiscal/.test(await summary.textContent()));
  const figures = await amounts(summary);
  checkoutTotal = figures[figures.length - 1];
  check(
    "and quotes the same total the cart did — nothing grows at the last step",
    cartTotal !== null && Math.abs(cartTotal - checkoutTotal) < 0.005,
    `panier ${cartTotal} DT · commande ${checkoutTotal} DT`
  );
}

/* --------------------------------------------------------------- [4] ----- */

console.log("\n[4] THE FACTURE'S LINES ADD UP TO WHAT WAS CHARGED");
let taxedRef = null;
{
  await p.locator('input[autocomplete="name"]').first().fill("Client Facture");
  await p.locator('input[autocomplete="tel"]').first().fill("20111444");
  await p.click('button:has-text("Ariana")');
  await p.waitForTimeout(250);
  await p.locator('[autocomplete="street-address"]').first().fill("12 avenue de Carthage");
  await p.click('button:has-text("Confirmer la commande")');
  await p.waitForURL(/confirmation/, { timeout: 30000 });
  taxedRef = p.url().split("/").pop();

  const order = await prisma.order.findUnique({
    where: { ref: taxedRef },
    select: { id: true, subtotal: true, shippingFee: true, total: true, vatRate: true, stampDuty: true },
  });
  const n = (d) => Number(d);
  check("the order snapshots the rate it was placed under", n(order.vatRate) === 19, `${n(order.vatRate)} %`);
  check("and the stamp it was charged", n(order.stampDuty) === 1, `${n(order.stampDuty)} DT`);
  check(
    "the stamp really is inside the stored total",
    Math.abs(n(order.total) - (n(order.subtotal) + n(order.shippingFee) + 1)) < 0.005,
    `${n(order.subtotal)} + ${n(order.shippingFee)} + 1 = ${n(order.total)}`
  );
  check(
    "which is the total the shopper agreed to two pages earlier",
    Math.abs(n(order.total) - checkoutTotal) < 0.005,
    `${checkoutTotal} DT → ${n(order.total)} DT`
  );

  // Still on the confirmation page: it lists the parts and then a larger
  // total, and everything in between has to be named there too — it is the
  // page a guest lands on, and the only one some of them will ever read.
  const confirmation = await p.textContent("main");
  check("the confirmation page names the livraison", /Livraison|Retrait/.test(confirmation));
  check("names the timbre fiscal it charged", /Timbre fiscal/.test(confirmation));
  check("and says how much of the total is TVA, under the total rather than in it",
    /dont TVA\s*19\s*%/.test(confirmation));

  await p.goto(`${BASE}/commande/${taxedRef}/recu`, { waitUntil: "domcontentloaded" });
  const body = await p.textContent("article");
  check("the document is now a facture", /Facture/.test(body));
  check("carrying the matricule", /1234567\/A\/M\/000/.test(body));
  check("the sous-total is stated HT", /Sous-total HT/.test(body));
  check("the TVA line states its rate", /TVA\s*19\s*%/.test(body));
  check("the timbre fiscal is a line of its own", /Timbre fiscal/.test(body));
  check("and the total is labelled TTC", /Total TTC/.test(body));

  const block = totalsTable(p);
  const goodsHT = await lineValue(block, "Sous-total HT");
  const shipHT = await lineValue(block, "Frais de livraison HT");
  const vat = await lineValue(block, "TVA");
  const stamp = await lineValue(block, "Timbre");
  const printed = await lineValue(block, "Total TTC");
  const summed = Math.round((goodsHT + shipHT + vat + stamp) * 100) / 100;
  check(
    "the four lines sum to the total, to the millime",
    Math.abs(summed - printed) < 0.005,
    `${goodsHT} + ${shipHT} + ${vat} + ${stamp} = ${summed} vs ${printed}`
  );
  check("the total printed is the total stored", Math.abs(printed - n(order.total)) < 0.005, `${printed} DT`);
  check(
    "the TVA is 19 % of the amounts excluding tax, not 19 % on top",
    Math.abs(vat - (goodsHT + shipHT) * 0.19) < 0.02,
    `${vat} vs ${Math.round((goodsHT + shipHT) * 19) / 100}`
  );
  check(
    "so the parts HT come to less than the prices on the cards, not more",
    goodsHT < n(order.subtotal),
    `${goodsHT} HT < ${n(order.subtotal)} TTC`
  );
}

/* --------------------------------------------------------------- [5] ----- */

console.log("\n[5] TURNING TVA ON DOES NOT RESTATE PAPER ALREADY FILED");
{
  // The order from [1] was placed before any of this was switched on. Its
  // rate is 0 on the row, and its document has to keep saying so — a settings
  // change must never rewrite what somebody was already charged and filed.
  await untaxed.goto(`${BASE}/commande/${untaxedRef}/recu`, { waitUntil: "domcontentloaded" });
  const body = await untaxed.textContent("article");
  check("the older order still prints no TVA", !/TVA/.test(body));
  check("and no timbre", !/[Tt]imbre/.test(body));
  check(
    "even though the shop is VAT registered today",
    /1234567\/A\/M\/000/.test(body),
    "the matricule is on it, because the shop has one now — the figures are not"
  );

  const order = await prisma.order.findUnique({ where: { ref: untaxedRef }, select: { total: true } });
  const printed = await lineValue(totalsTable(untaxed), "Total");
  check("its total is untouched", Math.abs(printed - Number(order.total)) < 0.005, `${printed} DT`);
}

/* --------------------------------------------------------------- [6] ----- */

console.log("\n[6] THE SCREEN AND THE PAPER TELL ONE STORY");
{
  // An admin is signed in on this context, and getOrderByRef lets them
  // through — which is what makes one document serve the customer and the
  // person packing the box.
  const stored = await prisma.order.findUnique({ where: { ref: taxedRef }, select: { id: true } });
  await admin.goto(`${BASE}/admin/commandes/${stored.id}`, { waitUntil: "domcontentloaded" });
  const body = await admin.textContent("body");
  check("the admin's order screen breaks out the TVA", /TVA\s*19\s*%/.test(body));
  check("and the timbre fiscal", /Timbre fiscal/.test(body));
  check("under a total labelled TTC", /Total TTC/.test(body));

  // The dashboard's "Revenu total" is the sum of what was charged, so with
  // TVA on it carries tax collected for the state. The figure is right; the
  // label has to say what is in it, or the month the matricule went in reads
  // as a jump in sales.
  await admin.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  check("the dashboard says its revenue figure is TTC", /toutes commandes, TTC/.test(await admin.textContent("main")));

  await admin.goto(`${BASE}/compte/commandes/${taxedRef}`, { waitUntil: "domcontentloaded" });
  const mine = await admin.textContent("body");
  if (/Sous-total/.test(mine)) {
    check(
      "and the customer's own order page shows the same breakdown",
      /Sous-total HT/.test(mine) && /TVA\s*19\s*%/.test(mine) && /Timbre fiscal/.test(mine)
    );
  } else {
    // Placed as a guest, so it belongs to no account and the account page
    // correctly refuses it. Nothing to compare, and nothing wrong.
    check("a guest order stays out of somebody else's account area", true);
  }
}

/* ------------------------------------------------------- cleanup --------- */

await browser.close();
for (const [key, value] of Object.entries(before)) {
  if (value === null) await prisma.setting.delete({ where: { key } }).catch(() => {});
  else await setSetting(key, value);
}
await prisma.$disconnect();

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
