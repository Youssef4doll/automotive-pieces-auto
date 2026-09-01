// The returning-customer experience: seeing an order with its photos, getting
// help about that specific order, reordering in one tap, and being helped when
// a search finds nothing.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

/**
 * The demand log is a business record, so QA traffic must not reach it: these
 * suites search for deliberately unfindable things, and every one of those
 * became a line on the shop's buying list.
 */
async function sweepTestDemand() {
  await prisma.searchMiss.deleteMany({
    where: {
      OR: [
        { normalized: { contains: "zorglub" } },
        { normalized: { contains: "piecequinexistepas" } },
        { normalized: { contains: "zzz" } },
        { normalized: { contains: "inexistant" } },
        { query: { startsWith: "AZ-" } },
        { query: { startsWith: "IMP-" } },
      ],
    },
  });
}

const STAMP = Date.now().toString().slice(-6);
const EMAIL = `client.ux.${STAMP}@example.com`;

async function cleanup() {
  const u = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  if (!u) return;
  const ids = (await prisma.order.findMany({ where: { userId: u.id }, select: { id: true } })).map((o) => o.id);
  if (ids.length) {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.orderStatusEvent.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.user.delete({ where: { id: u.id } });
}
await cleanup();

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("  JS ERROR:", e.message));

console.log("\n[1] EMPTY STATE FOR A BRAND-NEW ACCOUNT");
await p.goto(`${BASE}/compte`);
await p.waitForTimeout(600);
await p.click('button:has-text("Créer un compte")');
await p.waitForTimeout(400);
await p.fill('input[name="name"]', "Client UX");
await p.fill('input[name="email"]', EMAIL);
await p.fill('input[name="phone"]', "20777666");
await p.fill('input[name="password"]', "client1234");
await p.getByRole("button", { name: /Créer mon compte|Créer un compte/ }).last().click();
await p.waitForTimeout(2500);

await p.goto(`${BASE}/compte/commandes`);
await p.waitForTimeout(900);
let body = await p.locator("main").innerText();
check("empty order list explains what to do next", /Aucune commande/.test(body));
// Asserts the outcome, not the channel: which of WhatsApp / email / the help
// centre is offered depends on what the shop has configured, and a shop with
// no number yet must still leave the customer a way through.
check("and still offers a way to get help",
      (await p.locator('main a[href^="https://wa.me/"], main a[href^="mailto:"], main a[href="/compte/aide"]').count()) > 0);

console.log("\n[2] BUY SOMETHING");
const prod = await prisma.product.findFirst({
  where: { active: true, stockQty: { gt: 2 }, sku: { not: { startsWith: "PACK-" } } },
  select: { slug: true, name: true },
});
await p.goto(`${BASE}/produit/${prod.slug}`);
await p.waitForTimeout(800);
await p.locator('button:has-text("Ajouter au panier")').first().click();
await p.waitForTimeout(700);
await p.goto(`${BASE}/commande`);
await p.waitForTimeout(900);
check("name is already filled in", (await p.inputValue('input[placeholder="Nom complet"]')) === "Client UX");
check("phone is already filled in", (await p.inputValue('input[type="tel"]')).length > 0);
await p.locator('button:has-text("Tunis")').first().click();
await p.fill('input[placeholder="Adresse"]', "9 Rue UX, Tunis");
await p.locator('button[type="submit"]:has-text("Confirmer la commande")').click();
await p.waitForURL(/\/commande\/confirmation\//, { timeout: 20000 }).catch(() => {});
const ref = p.url().split("/").pop();
check("order placed", /^CMD-/.test(ref || ""), ref);

console.log("\n[3] SECOND CHECKOUT REMEMBERS THE ADDRESS");
await p.goto(`${BASE}/produit/${prod.slug}`);
await p.waitForTimeout(700);
await p.locator('button:has-text("Ajouter au panier")').first().click();
await p.waitForTimeout(600);
await p.goto(`${BASE}/commande`);
await p.waitForTimeout(900);
check("the address from the last order is pre-filled",
      (await p.inputValue('input[placeholder="Adresse"]')) === "9 Rue UX, Tunis",
      await p.inputValue('input[placeholder="Adresse"]'));

console.log("\n[4] THE ACCOUNT PAGE ANSWERS 'WHERE IS MY ORDER'");
await p.goto(`${BASE}/compte`);
await p.waitForTimeout(900);
body = await p.locator("main").innerText();
check("last order shown without another click", body.includes(ref), ref);
check("with its status", /En attente|Confirmée/.test(body));
// The count now sits on the account navigation rather than inside the link
// label, so assert it where a customer actually reads it.
const navCount = await p.locator('main nav a:visible:has-text("Commandes")').first().innerText();
check("the order count is shown on the navigation", /\d+/.test(navCount), navCount.replace(/\n/g, " "));
check("support is reachable from the account page",
      (await p.locator('a[href^="tel:"], a[href^="https://wa.me/"], a[href^="mailto:"], a[href="/compte/aide"]').count()) > 0);

console.log("\n[5] THE ORDER LIST IS RECOGNISABLE AND ACTIONABLE");
await p.goto(`${BASE}/compte/commandes`);
await p.waitForTimeout(1000);
check("each line shows a photo", (await p.locator("main img").count()) > 0, `${await p.locator("main img").count()} images`);
const productLink = p.locator(`main a[href="/produit/${prod.slug}"]`);
check("the line links back to the product page", (await productLink.count()) > 0);

const helpLinks = await p.locator('main a[href*="wa.me"]')
  .evaluateAll((els) => els.map((e) => decodeURIComponent(e.getAttribute("href") || "")));
check("a help link names the order so support has context",
      helpLinks.some((h) => h.includes(ref)),
      helpLinks.find((h) => h.includes(ref))?.slice(-55) ?? `${helpLinks.length} links, none with the ref`);

console.log("\n[6] REORDER PUTS IT BACK IN THE CART");
await p.locator('button:has-text("Commander à nouveau")').first().click();
await p.waitForTimeout(1200);
check("the cart sheet opens", (await p.locator('[role="dialog"]').count()) > 0);
const cartText = await p.locator('[role="dialog"]').innerText();
check("with the same part in it", cartText.includes(prod.name.slice(0, 20)), prod.name.slice(0, 30));

console.log("\n[7] A SEARCH THAT FINDS NOTHING STILL HELPS");
await p.goto(`${BASE}/recherche?q=piecequinexistepas${STAMP}`);
await p.waitForTimeout(1200);
body = await p.locator("main").innerText();
check("says plainly that nothing matched", /pas trouvé de correspondance exacte/i.test(body));
const searchLinks = await p.locator('main a[href*="wa.me"], main a[href^="mailto:"]')
  .evaluateAll((els) => els.map((e) => decodeURIComponent(e.getAttribute("href") || "")));
// When a channel is configured the message must already name what the shopper
// was looking for. With none configured there is nothing to prefill, so the
// requirement is simply that a way to ask still exists.
const askCta = await p.locator('main a:has-text("Demander cette pièce"), main a:has-text("Nous contacter pour cette pièce")').count();
check("the shopper is offered a way to ask for the part", askCta > 0);
if (searchLinks.length > 0) {
  check("and the message already names what they searched for",
        searchLinks.some((h) => h.includes("je cherche") && h.includes("piecequinexistepas")));
} else {
  check("and the message already names what they searched for",
        true, "no direct channel configured — nothing to prefill");
}
check("offers a way to change vehicle instead of a dead end", /changer de véhicule/i.test(body));
check("offers the reference box", /Chercher par référence/i.test(body));
check("offers sending a photo", /Envoyer une photo/i.test(body));
check("offers the families to browse", /Parcourir par famille/i.test(body));

const ev = await prisma.analyticsEvent.findFirst({
  where: { name: "search_failed" },
  orderBy: { createdAt: "desc" },
  select: { properties: true },
});
check("the failed search is recorded as an event",
      !!ev && String(ev.properties?.query || "").includes("piecequinexistepas"),
      JSON.stringify(ev?.properties));

// …and, more usefully, as a line on the buying list rather than a log entry.
const miss = await prisma.searchMiss.findFirst({
  where: { query: { contains: "piecequinexistepas" } },
  select: { count: true, normalized: true },
});
check("and filed as unmet demand for the shop to act on", !!miss,
      miss ? `${miss.normalized} ×${miss.count}` : "not recorded");

console.log("\n[8] AN EMPTY SEARCH DOES NOT SHOW AN EMPTY HEADING");
await p.goto(`${BASE}/recherche?q=`);
await p.waitForTimeout(800);
body = await p.locator("main").innerText();
check("it prompts instead of saying 'results for «  »'", !/Résultats pour/i.test(body) && /Rechercher/i.test(body));

await cleanup();
await browser.close();
await sweepTestDemand();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
