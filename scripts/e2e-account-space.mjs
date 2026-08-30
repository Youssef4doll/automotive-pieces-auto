// The customer's own space: one shell, navigable on both form factors, using
// the screen it is given, and built around the two things that actually drive
// repeat revenue — tracking an order and buying the same part again.
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

// ---- set up a customer with one order so the space has something to show ----
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

console.log("\n[1] AN EMPTY SPACE STILL POINTS SOMEWHERE");
await p.goto(`${BASE}/compte`);
await p.waitForTimeout(1200);
let body = await p.locator("main").innerText();
check("greets the customer by name", /Bonjour Sami/i.test(body));
check("no order yet is explained, not left blank", /Aucune commande/i.test(body));
check("and offers the next step", (await p.locator('main a:has-text("Trouver ma pièce")').count()) > 0);

console.log("\n[2] NAVIGATION EXISTS AND WORKS ON A PHONE");
for (const [tab, expect] of [["Commandes", /Mes commandes/i], ["Aide", /Questions fréquentes/i], ["Compte", /Bonjour Sami/i]]) {
  await p.locator(`main a:visible:has-text("${tab}")`).first().click();
  await p.waitForTimeout(1100);
  check(`  "${tab}" reaches its page`, expect.test(await p.locator("main").innerText()));
}
const current = await p.locator('main a[aria-current="page"]:visible').count();
check("the current tab is marked for assistive tech", current === 1, `${current} marked`);

console.log("\n[3] BUY IT ONCE");
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

console.log("\n[4] THE SPACE NOW LEADS WITH THE LIVE ORDER");
await p.goto(`${BASE}/compte`);
await p.waitForTimeout(1300);
body = await p.locator("main").innerText();
check("the in-flight order is the first thing shown", body.includes(ref), ref);
check("labelled as in progress, not just 'last order'", /Commande en cours/i.test(body));
check("the order card says when it was placed, to the minute",
      /Pass[ée]e le .+ à \d{2}:\d{2}/i.test(body.replace(/\n/g, " ")),
      body.replace(/\n/g, " ").match(/Pass[ée]e le [^·]+/i)?.[0]?.trim());
check("lifetime spend is summarised", /commande.*DT au total/i.test(body.replace(/\n/g, " ")));

// The order card's primary action must be above everything else on a phone.
const trackY = await p.locator('main a:has-text("Suivre ma commande")').first().boundingBox();
check("the tracking action is reachable without hunting", !!trackY && trackY.y < 900, `y=${Math.round(trackY?.y ?? -1)}`);

console.log("\n[5] BUY AGAIN — ONE TAP FROM A PAST PURCHASE");
const rail = p.locator('section[aria-labelledby="buy-again"]');
check("the rail appears once there is history", (await rail.count()) === 1);
check("it names the part they bought", (await rail.innerText()).includes(prod.name.slice(0, 20)));
await rail.locator('button:has-text("Ajouter")').first().click();
await p.waitForTimeout(1200);
check("tapping Ajouter confirms in place", /Ajouté/i.test(await rail.innerText()));
const count = await p.locator('header button[aria-label*="Panier"], header button:has-text("Panier")').first().innerText().catch(() => "");
check("and the item really is in the cart",
      (await p.evaluate(() => JSON.parse(localStorage.getItem("apa-cart") || "{}")?.state?.items?.length ?? 0)) > 0,
      count.replace(/\n/g, " "));

console.log("\n[6] THE HELP PAGE ANSWERS BEFORE A HUMAN HAS TO");
await p.goto(`${BASE}/compte/aide`);
await p.waitForTimeout(1000);
body = await p.locator("main").innerText();
check("it covers the fit question", /va sur ma voiture|compatib/i.test(body));
check("it covers the wrong-part fear", /mauvaise pièce/i.test(body));
check("answers are collapsed until asked for", (await p.locator("main details").count()) >= 5,
      `${await p.locator("main details").count()} questions`);
await p.locator("main details summary").first().click();
await p.waitForTimeout(300);
check("opening one reveals its answer", (await p.locator("main details[open]").count()) === 1);
const helpWa = await p.locator('main a[href*="wa.me"]').first().getAttribute("href");
check("the WhatsApp link already carries their order reference",
      decodeURIComponent(helpWa || "").includes(ref), decodeURIComponent(helpWa || "").slice(-46));

console.log("\n[7] IT USES A LAPTOP SCREEN INSTEAD OF IGNORING IT");
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: await ctx.storageState() });
const d = await desk.newPage();
d.on("pageerror", (e) => console.log("  JS ERROR (desktop):", e.message));
await d.goto(`${BASE}/compte`);
await d.waitForTimeout(1300);
const width = await d.evaluate(() => {
  const inner = document.querySelector("main")?.firstElementChild;
  return inner ? Math.round(inner.getBoundingClientRect().width) : 0;
});
check("content fills the screen rather than a mobile column", width > 1000, `${width}px of 1440`);
check("a side navigation is present on desktop", (await d.locator("main nav a:visible").count()) >= 3);
const visibleNavs = await d.evaluate(() =>
  [...document.querySelectorAll("main nav")].filter((n) => getComputedStyle(n).display !== "none").length);
check("only one navigation is visible at a time", visibleNavs === 1, `${visibleNavs} visible`);

console.log("\n[8] NO OVERFLOW, NO TINY CONTROLS, ANY SCREEN");
let bad = 0;
for (const w of [320, 360, 390, 414, 430, 768, 1024, 1280, 1440]) {
  const c = await browser.newContext({ viewport: { width: w, height: 900 }, storageState: await ctx.storageState() });
  const pg = await c.newPage();
  pg.on("pageerror", (e) => { console.log(`      JS ERROR ${w}px: ${e.message}`); bad++; });
  for (const u of ["/compte", "/compte/commandes", "/compte/aide"]) {
    await pg.goto(BASE + u);
    await pg.waitForTimeout(500);
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
check("clean across 9 widths x 3 pages", bad === 0, `${bad} issue(s)`);

await cleanup();
await browser.close();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
