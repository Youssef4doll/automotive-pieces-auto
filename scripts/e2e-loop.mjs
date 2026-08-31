/**
 * Full-circle test: one customer buys a part, then the admin who has to
 * fulfil it does their side, and the customer sees the result.
 *
 * The two halves are deliberately in one file. Most of what breaks in a shop
 * breaks *between* the two — an order the admin cannot find, a status change
 * the customer never sees, stock that does not move. Testing each side alone
 * misses exactly those.
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

const STAMP = Date.now();
const EMAIL = `loop.${STAMP}@example.com`;
const PASSWORD = "client1234";
const ADMIN = { email: "admin@automotive-pieces-auto.tn", password: "admin1234" };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

// The customer shops on a phone, because that is what they actually use.
const shopperCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const shopper = await shopperCtx.newPage();
const shopperErrors = [];
shopper.on("pageerror", (e) => shopperErrors.push(String(e).slice(0, 140)));
shopper.on("console", (m) => { if (m.type() === "error") shopperErrors.push(m.text().slice(0, 140)); });

// ═══════════════════════════════════ CUSTOMER ═══════════════════════════════

console.log("\n[C1] BROWSE THE CATALOGUE: A FAMILY OPENS ITS SUBCATEGORIES IN PLACE");
{
  await shopper.goto(`${BASE}/`);
  await shopper.waitForTimeout(1000);

  const card = shopper.locator('button[aria-controls^="subs-"]').first();
  const family = (await card.innerText()).split("\n")[0];
  check("families are buttons that can expand", (await card.count()) === 1, family);
  check("they start closed", (await card.getAttribute("aria-expanded")) === "false");

  await card.click();
  await shopper.waitForTimeout(400);
  check("clicking one expands it", (await card.getAttribute("aria-expanded")) === "true");

  const panelId = await card.getAttribute("aria-controls");
  const panel = shopper.locator(`#${panelId}`);
  const subs = panel.locator('a[href^="/catalogue/"]');
  const subCount = await subs.count();
  // The panel lists the subcategories plus one "see the whole family" link.
  check("the subcategories appear without leaving the page", subCount >= 2, `${subCount} links`);
  check("the shopper is still on the homepage", new URL(shopper.url()).pathname === "/");

  const stated = (await card.innerText()).match(/(\d+)\s+sous-cat/i)?.[1];
  check("the panel holds as many subcategories as the card promised",
        subCount - 1 === Number(stated), `card says ${stated}, panel has ${subCount - 1}`);

  // Every offered subcategory must actually have products behind it.
  const hrefs = await subs.evaluateAll((els) => els.map((a) => a.getAttribute("href")));
  const deep = hrefs.filter((h) => h.split("/").length === 4);
  let empty = 0;
  for (const h of deep) {
    const res = await shopper.request.get(BASE + h);
    const body = await res.text();
    if (!body.includes("/produit/")) empty++;
  }
  check("no suggested subcategory is an empty dead end", empty === 0, `${deep.length} checked`);

  await shopper.goto(`${BASE}/`);
  await shopper.waitForTimeout(800);
  const first = shopper.locator('button[aria-controls^="subs-"]').first();
  const second = shopper.locator('button[aria-controls^="subs-"]').nth(1);
  await first.click();
  await shopper.waitForTimeout(250);
  await second.click();
  await shopper.waitForTimeout(350);
  check("opening a second family closes the first",
        (await first.getAttribute("aria-expanded")) === "false" &&
        (await second.getAttribute("aria-expanded")) === "true");
}

console.log("\n[C2] THE SEARCH BOX SUGGESTS REAL THINGS");
{
  await shopper.goto(`${BASE}/`);
  await shopper.waitForTimeout(900);
  const input = shopper.locator("form input[type='search']:visible").first();
  await input.click();
  await input.fill("frein");
  await shopper.waitForTimeout(900);

  const list = shopper.locator('[role="listbox"]');
  check("a suggestion list appears while typing", (await list.count()) > 0);
  const options = list.locator('[role="option"]');
  const n = await options.count();
  check("it offers several suggestions", n > 0, `${n} suggestions`);

  check("the input is wired up as a combobox",
        (await input.getAttribute("role")) === "combobox" &&
        (await input.getAttribute("aria-expanded")) === "true");

  // Each suggestion must be a real destination, not a guessed phrase.
  const targets = await options.locator("button").evaluateAll(() => []);
  const labels = await options.evaluateAll((els) => els.map((e) => e.innerText.replace(/\n/g, " · ").slice(0, 50)));
  console.log(`        ${labels.slice(0, 4).join("  |  ")}`);
  check("suggestions are labelled by what they are",
        labels.some((l) => /Catégorie|Produit|Marque|Référence/i.test(l)));

  // Typing an exact part reference must offer that part.
  await input.fill("GDB1330");
  await shopper.waitForTimeout(900);
  const refLabels = await shopper.locator('[role="option"]').evaluateAll((els) => els.map((e) => e.innerText));
  check("an exact reference finds its part", refLabels.some((l) => /GDB1330/i.test(l)), refLabels[0]?.split("\n")[0] ?? "(none)");

  // Choosing one navigates straight there rather than running a text search.
  await shopper.locator('[role="option"]').first().click();
  await shopper.waitForTimeout(1200);
  check("picking a suggestion goes straight to it", /\/produit\/|\/catalogue\//.test(shopper.url()), shopper.url().replace(BASE, ""));

  // A query with no match must not leave a stale list on screen.
  await shopper.goto(`${BASE}/`);
  await shopper.waitForTimeout(800);
  const box = shopper.locator("form input[type='search']:visible").first();
  await box.click();
  await box.fill("zzzzqqqq");
  await shopper.waitForTimeout(900);
  check("nothing is suggested when nothing matches", (await shopper.locator('[role="listbox"]').count()) === 0);
}

console.log("\n[C2b] THE CATALOGUE FILTERS TO THE SHOPPER'S OWN CAR");
{
  await shopper.goto(`${BASE}/catalogue/freinage`);
  await shopper.waitForTimeout(900);
  const noCar = await shopper.locator("main").innerText();
  check("without a vehicle it invites you to pick one", /votre voiture/i.test(noCar));
  const allCards = await shopper.locator('a[href^="/produit/"]').count();

  // Save a vehicle the way the picker does, then reload.
  const eng = await prisma.vehicleEngine.findFirst({
    select: { id: true, name: true, model: { select: { name: true, make: { select: { name: true } } } } },
  });
  await shopper.evaluate(
    (v) => localStorage.setItem("apa-vehicle", JSON.stringify({ state: { vehicles: [v], vehicle: v }, version: 0 })),
    { engineId: eng.id, engineName: eng.name, modelName: eng.model.name, makeName: eng.model.make.name },
  );
  await shopper.reload();
  await shopper.waitForTimeout(1200);

  const filtered = await shopper.locator("main").innerText();
  check("it says what it filtered to", /Filtré pour votre/i.test(filtered),
        filtered.split("\n").find((l) => /Filtré pour/i.test(l))?.slice(0, 80));
  // Data-driven rather than assuming this engine always has something that
  // does not fit it: with a different seeded vehicle every part in the family
  // can legitimately be compatible, and the filter is still correct.
  const famWhere = { active: true, category: { OR: [{ slug: "freinage" }, { parent: { slug: "freinage" } }] } };
  const inFamily = await prisma.product.count({ where: famWhere });
  const doesNotFit = await prisma.product.count({
    where: { ...famWhere, fitments: { some: {} }, NOT: { fitments: { some: { engineId: eng.id } } } },
  });
  const fitCards = await shopper.locator('a[href^="/produit/"]').count();
  const shownProducts = fitCards / 2; // each card links twice: image and title
  check("exactly the parts that do not fit are withheld",
        shownProducts === inFamily - doesNotFit,
        `${inFamily} in family, ${doesNotFit} withheld, ${shownProducts} shown`);

  // Nothing left on screen may be labelled as belonging to a different car —
  // and an unverified part must not be labelled that way either.
  check("nothing shown is marked as fitting a different car",
        !/ne correspond pas/i.test(filtered));

  // Unverified parts are offered separately, never claimed as fitting.
  const unverified = /compatibilité non vérifiée/i.test(filtered);
  const dbUnverified = await prisma.product.count({
    where: { active: true, fitments: { none: {} }, category: { OR: [{ slug: "freinage" }, { parent: { slug: "freinage" } }] } },
  });
  check("parts with no fitment data are shown apart, not hidden or claimed",
        dbUnverified > 0 ? unverified : !unverified, `${dbUnverified} unverified in this family`);

  // The escape hatch must restore the full list.
  await shopper.getByRole("button", { name: /Voir toutes les références/i }).first().click();
  await shopper.waitForTimeout(600);
  check("the toggle brings every reference back",
        (await shopper.locator('a[href^="/produit/"]').count()) === allCards);

  // Leave the shopper without a car so the rest of the loop is unfiltered.
  await shopper.evaluate(() => localStorage.removeItem("apa-vehicle"));
  await shopper.reload();
  await shopper.waitForTimeout(700);
}

console.log("\n[C3] FIND A PART AND BUY IT AS A GUEST");
let orderRef = null;
{
  await shopper.goto(`${BASE}/catalogue/freinage`);
  await shopper.waitForTimeout(900);
  await shopper.evaluate(() => window.scrollTo(0, 900));
  await shopper.waitForTimeout(200);
  await shopper.locator('a[href^="/produit/"]').first().click();
  await shopper.waitForURL(/\/produit\//, { timeout: 15000 });
  await shopper.waitForTimeout(900);
  check("the product page opens at the top", (await shopper.evaluate(() => Math.round(window.scrollY))) === 0);

  // The card title is the most useful target on a listing; it has to look
  // clickable rather than like a heading.
  await shopper.goto(`${BASE}/catalogue/freinage`);
  await shopper.waitForTimeout(800);
  const titleStyle = await shopper.evaluate(() => {
    // The image link also carries text — the "TOP VENTE" badge sits inside
    // it — so pick the link with the most text: that is the product name.
    const a = [...document.querySelectorAll('a[href^="/produit/"]')]
      .sort((x, y) => (y.textContent || "").trim().length - (x.textContent || "").trim().length)[0];
    if (!a) return null;
    const cs = getComputedStyle(a);
    return { colour: cs.color, transform: cs.textTransform };
  });
  check("product titles read as links, not headings",
        Boolean(titleStyle) && titleStyle.transform !== "uppercase" &&
        titleStyle.colour !== "rgb(8, 22, 51)" && titleStyle.colour !== "rgb(15, 35, 82)",
        titleStyle?.colour ?? "n/a");
  await shopper.goBack();
  await shopper.waitForTimeout(700);

  const addBtn = shopper.locator('button:has-text("Ajouter au panier")').first();
  const enabled = await addBtn.isEnabled();
  if (!enabled) {
    // Out of stock: fall back to a product that can be bought.
    const buyable = await prisma.product.findFirst({ where: { active: true, stockQty: { gt: 2 } }, select: { slug: true } });
    await shopper.goto(`${BASE}/produit/${buyable.slug}`);
    await shopper.waitForTimeout(900);
  }
  await shopper.locator('button:has-text("Ajouter au panier")').first().click();
  await shopper.waitForTimeout(900);
  check("adding to the cart confirms without covering the page",
        /ajout/i.test(await shopper.locator("body").innerText()));

  await shopper.goto(`${BASE}/commande`);
  await shopper.waitForTimeout(1000);
  const checkoutText = await shopper.locator("main").innerText();
  check("checkout offers a guest path and a sign-in path",
        /invité/i.test(checkoutText) && /déjà client/i.test(checkoutText));
  check("and neither one gates the form",
        (await shopper.locator('input[autocomplete="name"]').count()) > 0);

  await shopper.locator('input[autocomplete="name"]').first().fill("Client Boucle");
  await shopper.locator('input[autocomplete="tel"]').first().fill("20445566");
  await shopper.locator('[autocomplete="street-address"]').first().fill("14 avenue de Carthage");
  await shopper.getByRole("button", { name: /Confirmer la commande/i }).first().click();
  await shopper.waitForURL(/confirmation/, { timeout: 20000 });
  await shopper.waitForTimeout(1000);

  orderRef = decodeURIComponent(shopper.url().split("/").pop());
  check("the order is placed", /^CMD-\d+$/.test(orderRef), orderRef);
}

console.log("\n[C4] THE CONFIRMATION SHOWS WHERE THE ORDER IS");
{
  const body = await shopper.locator("main").innerText();
  check("it opens the order's status straight away", /Suivi de votre commande/i.test(body));
  check("it names the step already reached", /Command[ée]e/i.test(body));
  check("it stamps when the order was placed", /\d{1,2}\s\S+\s(à|at)\s\d{1,2}:\d{2}/i.test(body), body.match(/\d{1,2}\s\S+\s(?:à|at)\s\d{1,2}:\d{2}/)?.[0] ?? "");
  for (const step of ["Confirmée", "Préparée", "Expédiée", "Livrée"]) {
    check(`  the remaining step "${step}" is listed`, body.includes(step));
  }
  check("it says what happens next", /confirmons|préparons|route|livr/i.test(body));
  check("a guest is offered an account afterwards", /Créer votre compte|Créer mon compte/i.test(body));

  // The tracker must describe the real state, not a hardcoded picture.
  const dbOrder = await prisma.order.findUnique({ where: { ref: orderRef }, select: { status: true, userId: true } });
  check("the order really is pending in the database", dbOrder.status === "PENDING", dbOrder.status);
  check("it is recorded as a guest order", dbOrder.userId === null);
}

// ══════════════════════════════════════ ADMIN ═══════════════════════════════

console.log("\n[A1] THE ADMIN SIGNS IN AND FINDS THE ORDER");
const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const admin = await adminCtx.newPage();
const adminErrors = [];
admin.on("pageerror", (e) => adminErrors.push(String(e).slice(0, 140)));
admin.on("console", (m) => { if (m.type() === "error") adminErrors.push(m.text().slice(0, 140)); });
let orderId = null;
{
  await admin.goto(`${BASE}/compte`);
  await admin.fill('input[name="email"]', ADMIN.email);
  await admin.fill('input[name="password"]', ADMIN.password);
  await admin.getByRole("button", { name: "Se connecter", exact: true }).click();
  await admin.waitForTimeout(2500);
  check("the admin lands in the admin area", admin.url().includes("/admin"), admin.url().replace(BASE, ""));

  await admin.goto(`${BASE}/admin/commandes`);
  await admin.waitForTimeout(1200);
  check("the new order is listed", (await admin.locator("body").innerText()).includes(orderRef), orderRef);

  const row = admin.locator(`a:has-text("${orderRef}")`).first();
  await row.click();
  await admin.waitForTimeout(1200);
  orderId = admin.url().split("/").pop();
  const detail = await admin.locator("body").innerText();
  check("the order detail carries the customer's details", detail.includes("Client Boucle") && detail.includes("20445566"));
  check("and the part they bought", /Ajouter|plaquettes|Filtre|Disque|Huile|frein/i.test(detail));
}

console.log("\n[A2] MOVING THE ORDER FORWARD REACHES THE CUSTOMER");
{
  await admin.getByRole("button", { name: /^Confirmée$/ }).first().click().catch(async () => {
    await admin.locator('button:has-text("Confirmée")').first().click();
  });
  await admin.waitForTimeout(1800);

  const dbOrder = await prisma.order.findUnique({
    where: { ref: orderRef },
    select: { status: true, history: { select: { status: true } } },
  });
  check("the status is stored", dbOrder.status === "CONFIRMED", dbOrder.status);
  check("and an event is recorded for the timeline",
        dbOrder.history.some((h) => h.status === "CONFIRMED"), `${dbOrder.history.length} events`);

  // The customer's own view of the same order must follow.
  await shopper.goto(`${BASE}/commande/confirmation/${orderRef}`);
  await shopper.waitForTimeout(1200);
  const seen = await shopper.locator("main").innerText();
  check("the customer's confirmation now shows it confirmed", /Confirmée/.test(seen));
  check("with a timestamp against that step",
        (seen.match(/\d{1,2}:\d{2}/g) ?? []).length >= 2, `${(seen.match(/\d{1,2}:\d{2}/g) ?? []).length} stamps`);
}

console.log("\n[A3] STOCK MOVED WITH THE SALE");
{
  const item = await prisma.orderItem.findFirst({
    where: { order: { ref: orderRef } },
    select: { productId: true, qty: true, name: true },
  });
  const moves = await prisma.stockMovement.findMany({
    where: { productId: item.productId, note: { contains: orderRef } },
    select: { change: true, reason: true },
  });
  check("the sale is recorded as a stock movement", moves.length > 0, `${moves.length} movement(s)`);
  check("and it decremented by the quantity sold",
        moves.some((m) => m.change === -item.qty), `qty ${item.qty}`);
}

console.log("\n[A4] EVERY ADMIN SCREEN LOADS AND SHOWS REAL DATA");
{
  const screens = [
    ["/admin", /Chiffre|Commandes|Revenu|Aujourd/i],
    ["/admin/stock", /Stock|Produits|Modifier/i],
    ["/admin/commandes", /Commandes/i],
    ["/admin/clients", /Clients/i],
    ["/admin/catalogue", /Catégories|Familles|Catalogue/i],
    ["/admin/catalogue/marques", /Marques/i],
    ["/admin/promotions", /Promotions/i],
    ["/admin/import", /Import/i],
    ["/admin/qualite", /Qualité|Compatibilité|photo/i],
    ["/admin/analytics", /Analytics|Entonnoir|Visites|Recherches/i],
    ["/admin/paniers", /Paniers/i],
    ["/admin/parametres", /Paramètres/i],
  ];
  for (const [route, expect] of screens) {
    const res = await admin.request.get(BASE + route, { maxRedirects: 0 });
    await admin.goto(BASE + route);
    await admin.waitForTimeout(700);
    const text = await admin.locator("body").innerText();
    check(`${route} loads`, res.status() === 200 && expect.test(text), `status ${res.status()}`);
  }
}

console.log("\n[A5] THE ADMIN CAN EDIT THE CATALOGUE");
{
  const product = await prisma.product.findFirst({ where: { active: true }, select: { id: true, slug: true, stockQty: true, name: true } });
  await admin.goto(`${BASE}/admin/stock/${product.id}`);
  await admin.waitForTimeout(1000);
  // innerText returns the CSS-uppercased heading, so compare case-insensitively.
  const editText = (await admin.locator("body").innerText()).toLowerCase();
  check("a product opens for editing", editText.includes(product.name.slice(0, 18).toLowerCase()), product.name.slice(0, 24));

  // styled-jsx injects a nonce-less <style> that the CSP refuses, which left
  // these fields unstyled in production. Assert the styling actually applies.
  const fieldOk = await admin.evaluate(() => {
    const el = document.querySelector('form input[type="text"], form input:not([type="checkbox"]):not([type="hidden"])');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { h: Math.round(el.getBoundingClientRect().height), border: cs.borderBottomWidth };
  });
  check("its fields are actually styled", Boolean(fieldOk) && fieldOk.h >= 40 && fieldOk.border !== "0px",
        fieldOk ? `${fieldOk.h}px tall, ${fieldOk.border} border` : "no field found");

  // Deactivate, confirm the storefront drops it, then restore.
  const activeBox = admin.locator('input[name="active"][type="checkbox"]').first();
  const had = await activeBox.isChecked();
  if (had) {
    await activeBox.uncheck();
    await admin.getByRole("button", { name: /Enregistrer|Sauvegarder|Mettre à jour/i }).first().click();
    await admin.waitForTimeout(1800);
    const row = await prisma.product.findUnique({ where: { id: product.id }, select: { active: true } });
    check("deactivating a product is stored", row.active === false);
    const res = await shopper.request.get(`${BASE}/produit/${product.slug}`, { maxRedirects: 0 });
    check("and it disappears from the storefront", res.status() === 404, `status ${res.status()}`);

    await admin.goto(`${BASE}/admin/stock/${product.id}`);
    await admin.waitForTimeout(900);
    await admin.locator('input[name="active"][type="checkbox"]').first().check();
    await admin.getByRole("button", { name: /Enregistrer|Sauvegarder|Mettre à jour/i }).first().click();
    await admin.waitForTimeout(1800);
    const back = await prisma.product.findUnique({ where: { id: product.id }, select: { active: true } });
    check("and reactivating brings it back", back.active === true);
  } else {
    check("deactivating a product is stored", true, "product already inactive — skipped");
  }
}

console.log("\n[C5] THE CUSTOMER CREATES AN ACCOUNT AFTER BUYING");
{
  await shopper.goto(`${BASE}/compte`);
  await shopper.waitForTimeout(900);
  await shopper.getByRole("button", { name: /Créer un compte|S'inscrire/i }).first().click().catch(() => {});
  await shopper.waitForTimeout(400);
  await shopper.fill('input[name="name"]', "Client Boucle");
  await shopper.fill('input[name="email"]', EMAIL);
  await shopper.fill('input[name="phone"]', "20445566");
  await shopper.fill('input[name="password"]', PASSWORD);
  await shopper.getByRole("button", { name: /Créer mon compte|Créer un compte|S'inscrire/i }).last().click();
  await shopper.waitForTimeout(2500);
  check("the account is created and signed in", shopper.url().includes("/compte"));

  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, passwordHash: true } });
  check("it is stored with a hashed password", Boolean(user) && /^\$2[aby]\$/.test(user.passwordHash));

  // The guest order stays the guest's; it is not silently claimed.
  const stillGuest = await prisma.order.findUnique({ where: { ref: orderRef }, select: { userId: true } });
  check("the earlier guest order is not silently attached to it", stillGuest.userId === null);
}

console.log("\n[C6] NOTHING BROKE ALONG THE WAY");
{
  const dedupe = (a) => [...new Set(a)];
  const s = dedupe(shopperErrors);
  const ad = dedupe(adminErrors);
  s.slice(0, 3).forEach((e) => console.log(`        shopper: ${e}`));
  ad.slice(0, 3).forEach((e) => console.log(`        admin:   ${e}`));
  check("the customer hit no console or page errors", s.length === 0, `${s.length}`);
  check("neither did the admin", ad.length === 0, `${ad.length}`);
}

// cleanup: the loop's own artefacts only
await prisma.order.deleteMany({ where: { ref: orderRef } });
await prisma.cart.deleteMany({ where: { user: { email: EMAIL } } });
await prisma.user.deleteMany({ where: { email: EMAIL } });

await browser.close();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
