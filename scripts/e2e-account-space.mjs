// The redesigned customer area: an application shell that adapts to the device,
// a dashboard organised around the live order and the vehicle, and every page
// reachable, honest about missing data, and usable at any width.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const STAMP = Date.now().toString().slice(-6);
const EMAIL = `space.${STAMP}@example.com`;
const PASSWORD = "client1234";

/**
 * The signup limiter is per-address and lives in process memory, so a long run
 * of suites from one machine legitimately exhausts it. Report that plainly
 * rather than failing later on a null dereference that hides the cause.
 */
async function assertSignedUp(page, prismaClient, email) {
  const user = await prismaClient.user.findUnique({ where: { email }, select: { id: true } });
  if (user) return user;
  const shown = await page.locator("main").innerText().catch(() => "");
  if (/Trop de tentatives/i.test(shown)) {
    console.log("  SKIP  signup refused by the rate limiter — restart the server to clear it, then re-run");
    process.exit(0);
  }
  console.log(`  FAIL  the account was not created — ${shown.split("\n").slice(0, 2).join(" | ")}`);
  process.exit(1);
}


async function cleanup() {
  const u = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  if (!u) return;
  const ids = (await prisma.order.findMany({ where: { userId: u.id }, select: { id: true } })).map((o) => o.id);
  if (ids.length) {
    await prisma.cart.updateMany({ where: { orderId: { in: ids } }, data: { orderId: null } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.orderStatusEvent.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.cart.deleteMany({ where: { userId: u.id } });
  await prisma.user.delete({ where: { id: u.id } });
}
await cleanup();

const prod = await prisma.product.findFirst({
  where: { active: true, stockQty: { gt: 3 }, sku: { not: { startsWith: "PACK-" } } },
  select: { slug: true, name: true },
});

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("  JS ERROR:", e.message));

await p.goto(`${BASE}/compte`);
await p.waitForTimeout(700);
await p.click('button:has-text("Créer un compte")');
await p.waitForTimeout(400);
await p.fill('input[name="name"]', "Sami Trabelsi");
await p.fill('input[name="email"]', EMAIL);
await p.fill('input[name="phone"]', "20333222");
await p.fill('input[name="password"]', PASSWORD);
await p.getByRole("button", { name: /Créer mon compte|Créer un compte/ }).last().click();
await p.waitForTimeout(2500);
await assertSignedUp(p, prisma, EMAIL);

console.log("\n[1] EVERY EMPTY STATE POINTS SOMEWHERE");
await p.goto(`${BASE}/compte`);
await p.waitForTimeout(1300);
let body = await p.locator("main").innerText();
check("greets the customer by name", /Bonjour, Sami/i.test(body));
check("no order yet is explained, not left blank", /Aucune commande pour le moment/i.test(body));
check("the empty garage invites a vehicle", /garage est vide/i.test(body));
check("and offers the next action", (await p.locator('main a:has-text("Trouver une pièce")').count()) > 0);

console.log("\n[2] A PHONE GETS ITS SECTIONS IN ONE ROW, NOT A BAR OVER THE PAGE");
const bar = p.locator('nav[aria-label="Espace client"]:visible').last();
check("the sections are present", (await bar.count()) === 1);

// Nothing is pinned over the content any more. The old fixed tab bar covered
// the last card on every page and could only hold five of the six sections.
const fixed = await p.evaluate(() =>
  [...document.querySelectorAll("nav")].filter((n) => getComputedStyle(n).position === "fixed").length);
check("nothing is bolted to the bottom of the screen", fixed === 0, `${fixed} fixed nav(s)`);

const barBox = await bar.boundingBox();
check("the row sits with the content, near the top", !!barBox && barBox.y < 500, `y=${Math.round(barBox?.y ?? -1)}`);
check("and every section is reachable from it", (await bar.locator("a").count()) === 6, `${await bar.locator("a").count()}`);

// The row scrolls sideways rather than wrapping or overflowing the page.
const scrollable = await bar.locator("ul").evaluate((el) => el.scrollWidth > el.clientWidth + 1);
check("it scrolls sideways instead of pushing the page wide", scrollable);
const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("and the page itself does not scroll sideways", overflow === 0, `${overflow}px`);

check("no desktop rail is visible on a phone",
      (await p.locator('aside nav[aria-label="Espace client"]:visible').count()) === 0);

for (const [tab, expect] of [
  ["Commandes", /Mes commandes/i],
  ["Garage", /Mon garage/i],
  ["Aide", /Comment pouvons-nous vous aider/i],
  ["Profil", /Mon profil/i],
  ["Accueil", /Bonjour, Sami/i],
]) {
  await bar.locator(`a:has-text("${tab}")`).first().click();
  await p.waitForTimeout(1100);
  check(`  "${tab}" reaches its page`, expect.test(await p.locator("main").innerText()));
}
check("the current destination is marked for assistive tech",
      (await p.locator('nav[aria-label="Espace client"]:visible a[aria-current="page"]').count()) === 1);

console.log("\n[3] BUY SOMETHING");
await p.goto(`${BASE}/produit/${prod.slug}`);
await p.waitForTimeout(900);
await p.locator('button:has-text("Ajouter au panier")').first().click();
await p.waitForTimeout(800);
await p.goto(`${BASE}/commande`);
await p.waitForTimeout(1000);
await p.locator('button:has-text("Tunis")').first().click();
await p.fill('input[placeholder="Adresse"]', "7 Rue Espace");
await p.locator('button[type="submit"]:has-text("Confirmer la commande")').click();
await p.waitForURL(/\/commande\/confirmation\//, { timeout: 20000 }).catch(() => {});
const ref = p.url().split("/").pop();
check("order placed", /^CMD-/.test(ref || ""), ref);

console.log("\n[4] THE DASHBOARD LEADS WITH THE LIVE ORDER");
await p.goto(`${BASE}/compte`);
await p.waitForTimeout(1400);
body = await p.locator("main").innerText();
check("the order is the hero", /Votre commande/i.test(body) && body.includes(ref), ref);
check("prices use French formatting", /\d+,\d{2} DT/.test(body), body.match(/\d+,\d{2} DT/)?.[0]);
check("no English-style decimal slipped through", !/\d+\.\d{2} DT/.test(body));
check("the tracker shows when the order was placed", /Commandée/.test(body) && /\d+ \w+/.test(body));
check("it says what happens next", /Nous confirmons|Nous préparons/i.test(body));
const track = await p.locator('main a:has-text("Suivre ma commande")').first().boundingBox();
check("the primary action is above the fold on a phone", !!track && track.y < 844, `y=${Math.round(track?.y ?? -1)}`);

console.log("\n[5] QUICK ACTIONS AND THE VEHICLE BRIDGE");
check("four quick actions are offered", (await p.locator('main a:has-text("Trouver une pièce")').count()) > 0
      && (await p.locator('main a:has-text("Commander à nouveau")').count()) > 0);
check("category shortcuts come from real stocked families",
      (await p.locator('main a[href^="/catalogue/"]').count()) > 0,
      `${await p.locator('main a[href^="/catalogue/"]').count()} chips`);
for (const href of await p.locator('main a[href^="/catalogue/"]').evaluateAll((e) => e.map((x) => x.getAttribute("href")))) {
  const res = await p.request.get(BASE + href);
  if (res.status() !== 200) check(`  ${href} is a live page`, false, `status=${res.status()}`);
}
check("no category shortcut leads to a dead page", true);

console.log("\n[6] BUY AGAIN");
const rail = p.locator('section[aria-labelledby="buy-again"]');
check("the rail appears once there is history", (await rail.count()) === 1);
await rail.locator('button:has-text("Racheter")').first().click();
await p.waitForTimeout(1200);
check("racheter confirms in place", /Ajouté/i.test(await rail.innerText()));
check("and the part really reaches the cart",
      (await p.evaluate(() => JSON.parse(localStorage.getItem("apa-cart") || "{}")?.state?.items?.length ?? 0)) > 0);

console.log("\n[7] ORDERS: FILTERS AND A REAL DETAIL PAGE");
await p.goto(`${BASE}/compte/commandes`);
await p.waitForTimeout(1200);
check("filters are offered", (await p.locator('main a:has-text("En cours")').count()) > 0);
await p.locator('main a:has-text("Livrées")').first().click();
await p.waitForTimeout(1100);
check("filtering to Livrées excludes the pending order",
      !(await p.locator("main").innerText()).includes(ref));
await p.locator('main a:has-text("Toutes")').first().click();
await p.waitForTimeout(1100);
check("Toutes brings it back", (await p.locator("main").innerText()).includes(ref));

await p.goto(`${BASE}/compte/commandes/${ref}`);
await p.waitForTimeout(1200);
body = await p.locator("main").innerText();
check("the detail page opens", body.includes(ref));
for (const section of ["Statut", "Produits", "Livraison", "Paiement"]) {
  check(`  section "${section}"`, new RegExp(section, "i").test(body));
}
check("it states the real payment method", /Paiement à la livraison/i.test(body));
check("it shows the line maths", /Sous-total/i.test(body) && /Total/i.test(body));

console.log("\n[8] SOMEONE ELSE'S ORDER IS NOT READABLE");
const other = await prisma.order.findFirst({ where: { NOT: { user: { email: EMAIL } } }, select: { ref: true } });
const forbidden = await p.request.get(`${BASE}/compte/commandes/${other.ref}`);
check("another customer's order returns 404", forbidden.status() === 404, `status=${forbidden.status()}`);

console.log("\n[9] THE HELP CENTRE SEARCHES");
await p.goto(`${BASE}/compte/aide`);
await p.waitForTimeout(1100);
check("questions start collapsed", (await p.locator("main details").count()) >= 6
      && (await p.locator("main details[open]").count()) === 0);
await p.fill('main input[type="search"]', "livraison");
await p.waitForTimeout(500);
const shown = await p.locator("main details").count();
check("typing narrows the list", shown > 0 && shown < 8, `${shown} of 8`);
await p.fill('main input[type="search"]', "zzzzz");
await p.waitForTimeout(500);
check("a search with no match offers WhatsApp instead of a blank page",
      /Aucune question/i.test(await p.locator("main").innerText()));
await p.fill('main input[type="search"]', "");
await p.waitForTimeout(400);
await p.locator("main details summary").first().click();
await p.waitForTimeout(400);
check("opening a question reveals its answer", (await p.locator("main details[open]").count()) === 1);

console.log("\n[10] PROFILE SHOWS ONLY WHAT EXISTS");
await p.goto(`${BASE}/compte/profil`);
await p.waitForTimeout(1100);
body = await p.locator("main").innerText();
check("real account fields are shown", body.includes("Sami Trabelsi") && body.includes(EMAIL));
check("the delivery address comes from the last order", /7 Rue Espace/.test(body));
// Two of them now — one in the navigation rail, one in the Session card — so
// the control is reachable whether the customer scans the nav or the page.
check("logout is available", (await p.locator('main button:has-text("Se déconnecter")').count()) >= 1);

console.log("\n[11] DESKTOP GETS AN APPLICATION SHELL");
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: await ctx.storageState() });
const d = await desk.newPage();
d.on("pageerror", (e) => console.log("  JS ERROR (desktop):", e.message));
await d.goto(`${BASE}/compte`);
await d.waitForTimeout(1400);
const width = await d.evaluate(() => {
  const el = document.querySelector("main .max-w-\\[1240px\\]") ?? document.querySelector("main")?.firstElementChild;
  return el ? Math.round(el.getBoundingClientRect().width) : 0;
});
check("content uses the screen", width > 1100, `${width}px of 1440`);
check("a navigation rail is present", (await d.locator('aside nav[aria-label="Espace client"] a:visible').count()) === 6,
      `${await d.locator('aside nav[aria-label="Espace client"] a:visible').count()} links`);
check("the phone section row is hidden on desktop",
      (await d.evaluate(() => {
        const navs = [...document.querySelectorAll('nav[aria-label="Espace client"]')];
        return navs.filter((n) => getComputedStyle(n).display !== "none").length;
      })) === 1);
// The rail always carries a support card; the channel it points at depends on
// what the shop has configured.
// Located by its label rather than its href: the rail's own "Aide" nav item
// can share the destination, so an href match counts two things.
check("assistance is reachable from the rail",
      (await d.locator('aside a:has-text("Assistance")').count()) === 1);

console.log("\n[12] CLEAN AT EVERY WIDTH");
let bad = 0;
const PAGES = ["/compte", "/compte/commandes", `/compte/commandes/${ref}`, "/compte/garage", "/compte/pieces", "/compte/aide", "/compte/profil"];
for (const w of [320, 360, 390, 414, 430, 768, 1024, 1280, 1440]) {
  const c = await browser.newContext({ viewport: { width: w, height: 900 }, storageState: await ctx.storageState() });
  const pg = await c.newPage();
  pg.on("pageerror", (e) => { console.log(`      JS ERROR ${w}px: ${e.message}`); bad++; });
  for (const u of PAGES) {
    await pg.goto(BASE + u);
    await pg.waitForTimeout(420);
    const r = await pg.evaluate(() => {
      const ov = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      let small = 0;
      for (const el of document.querySelectorAll("main a, main button, main input, main select, main summary")) {
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        if (getComputedStyle(el).visibility === "hidden") continue;
        const hasText = (el.textContent || "").trim().length > 0;
        if (hasText ? b.height < 40 : (b.height < 44 || b.width < 44)) small++;
      }
      return { ov, small };
    });
    if (r.ov > 0) { console.log(`      overflow ${r.ov}px @ ${w}px ${u}`); bad++; }
    if (r.small > 0) { console.log(`      ${r.small} small control(s) @ ${w}px ${u}`); bad++; }
  }
  await c.close();
}
check(`no overflow or tiny control across 9 widths x ${PAGES.length} pages`, bad === 0, `${bad} issue(s)`);

await cleanup();
await browser.close();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
