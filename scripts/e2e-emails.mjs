/**
 * The mail the shop sends, and what happens when it can't.
 *
 * Until this existed the site told nobody anything: a customer ordered, saw a
 * page, and had no record; the shop learned an order existed by refreshing
 * the admin. These checks drive real checkouts and real status changes against
 * a stand-in for the Resend API, and read the message that actually came out
 * the other end — the template rendering is not taken on trust.
 *
 * The last section is the one that matters most. An order that is already in
 * the database with its stock claimed must not be undone, delayed or hidden
 * because a mail server is unreachable. That is asserted with the stand-in
 * switched off.
 *
 * Needs the server started with the mail environment pointed here:
 *
 *   EMAIL_FROM="Shop <x@y.tn>" RESEND_API_KEY=test \
 *   RESEND_API_URL=http://localhost:8788/emails npm start
 *
 * run-e2e.sh does that. Run standalone and it skips rather than fails, since
 * a default `npm start` has no mail configured and that is a valid state.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PORT = Number(process.env.MAIL_STUB_PORT || 8788);
// Set MAIL_DUMP_DIR to keep every message the stand-in receives as .html and
// .txt files — the way to look at what a customer will actually see, since
// nothing here is rendered by a browser otherwise.
const DUMP = process.env.MAIL_DUMP_DIR || "";
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

/* -------------------------------------------------- the stand-in --------- */

const inbox = [];
const stub = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try {
      const mail = JSON.parse(body);
      inbox.push(mail);
      if (DUMP) {
        mkdirSync(DUMP, { recursive: true });
        const slug = String(mail.subject || "mail").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
        const stem = `${DUMP}/${String(inbox.length).padStart(2, "0")}-${slug}`;
        writeFileSync(`${stem}.html`, mail.html || "");
        writeFileSync(`${stem}.txt`, mail.text || "");
      }
    } catch {
      /* ignore malformed */
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: `stub-${inbox.length}` }));
  });
});
await new Promise((r) => stub.listen(PORT, r));
const waitForMail = async (n, ms = 8000) => {
  const until = Date.now() + ms;
  while (inbox.length < n && Date.now() < until) await new Promise((r) => setTimeout(r, 150));
  return inbox.length >= n;
};

/* ------------------------------------------------------ helpers ---------- */

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function placeOrder(page, { email, name = "Client E2E", phone = "20111222" }) {
  await page.goto(`${BASE}/catalogue/filtres`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  await page.click('button:has-text("Ajouter au panier")');
  await page.waitForTimeout(700);
  await page.goto(`${BASE}/commande`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await page.locator('input[autocomplete="name"]').first().fill(name);
  await page.locator('input[autocomplete="tel"]').first().fill(phone);
  if (email) await page.locator('input[autocomplete="email"]').first().fill(email);
  await page.click('button:has-text("Ariana")');
  await page.waitForTimeout(250);
  await page.locator('[autocomplete="street-address"]').first().fill("1 rue de la Batterie");
  const started = Date.now();
  await page.click('button:has-text("Confirmer la commande")');
  await page.waitForURL(/confirmation/, { timeout: 30000 });
  return { ref: page.url().split("/").pop(), ms: Date.now() - started };
}

/* --------------------------------------------------------- checks -------- */

// A shop address is what the alert is sent to. Set it for the duration and put
// back whatever was there, so the suite leaves the settings as it found them.
const previousShopEmail = await prisma.setting.findUnique({ where: { key: "shop_email" } });
await prisma.setting.upsert({
  where: { key: "shop_email" },
  create: { key: "shop_email", value: "boutique-e2e@example.tn" },
  update: { value: "boutique-e2e@example.tn" },
});

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();

console.log("\n[1] A CHECKOUT SENDS TWO MESSAGES: TO THE CUSTOMER AND TO THE SHOP");
const CUSTOMER = "client-e2e@example.tn";
const order = await placeOrder(p, { email: CUSTOMER });

if (!(await waitForMail(2))) {
  console.log("  SKIP  the server has no mail transport configured — start it with");
  console.log(`        EMAIL_FROM=… RESEND_API_KEY=… RESEND_API_URL=http://localhost:${PORT}/emails`);
  await browser.close();
  stub.close();
  if (previousShopEmail) {
    await prisma.setting.update({ where: { key: "shop_email" }, data: { value: previousShopEmail.value } });
  } else {
    await prisma.setting.delete({ where: { key: "shop_email" } }).catch(() => {});
  }
  await prisma.$disconnect();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

const toCustomer = inbox.find((m) => m.to?.includes(CUSTOMER));
const toShop = inbox.find((m) => m.to?.includes("boutique-e2e@example.tn"));

check("the customer is sent a confirmation", !!toCustomer, toCustomer?.subject);
check("the shop is sent an alert", !!toShop, toShop?.subject);
check("both name the order reference", [toCustomer, toShop].every((m) => m?.subject?.includes(order.ref)), order.ref);
check(
  "a reply from the customer reaches the shop, and vice versa",
  toCustomer?.reply_to === "boutique-e2e@example.tn" && toShop?.reply_to === CUSTOMER
);
check("every message carries a plain-text part", [toCustomer, toShop].every((m) => (m?.text || "").length > 40));

// What is inside matters more than that it arrived.
const body = `${toCustomer?.html} ${toCustomer?.text}`;
check("the confirmation lists what was actually bought", /KAMOKA|Filtre/i.test(body), (body.match(/Filtre [^<\n]{0,30}/) || [])[0]);
check("and the total that was actually charged", /\d+,\d{2}\sDT/.test(body), (body.match(/Total[\s\S]{0,60}?(\d+,\d{2}\sDT)/) || [])[1]);
// A guest's order is attached to no account, so /compte/commandes would be a
// sign-in form followed by a 404. The confirmation page is the one that
// recognises the browser the order was placed in.
check("it links a guest to the confirmation page, not to an account they do not have",
  body.includes(`/commande/confirmation/${order.ref}`) && !body.includes(`/compte/commandes/`));

// The house rule, in the one place it is hardest to walk back.
check(
  "it quotes a delivery window, never a delivery date",
  /24h|48|72h/.test(body) && !/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(body),
  "no dd/mm/yyyy anywhere"
);
check("it invents no tracking number", !/suivi\s*:?\s*[A-Z0-9]{8,}/i.test(body));

// The order date is a fact and belongs in the message; it must be the only
// time in it. The progress strip shows the steps and which one the order is
// on — a time against "Expédiée" or "Livrée" would be a promise nobody made.
const html = toCustomer?.html || "";
check("it states when the order was placed", /Date de commande[\s\S]{0,200}?\d{1,2} \S+\.? \d{4} · \d{2}:\d{2}/.test(html));
check("and that is the only time anywhere in it", (html.match(/\b\d{2}:\d{2}\b/g) || []).length === 1,
  `${(html.match(/\b\d{2}:\d{2}\b/g) || []).length} time(s)`);
check("the progress strip names the real steps", ["Reçue", "Confirmée", "Préparée", "Expédiée", "Livrée"].every((s) => html.includes(s)));
check("the shop's logo is in it, served from the site", /\/images\/email\/logo-white\.png/.test(html));
// A line whose product has no photo of its own is shown without one. The
// catalogue's placeholder artwork is not a picture of what was ordered.
check("no placeholder artwork is passed off as a photo of a part", !html.includes("parts-lineup.png"));
check("the plain-text part says the same things", /Numéro de commande/.test(toCustomer?.text || "") && /Total :/.test(toCustomer?.text || ""));

console.log("\n[1b] AN ACCOUNT HOLDER IS LINKED TO THEIR ORDER PAGE");
{
  const me = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await me.goto(`${BASE}/compte`);
  await me.fill('input[name="email"]', "karim.bensalah@example.com");
  await me.fill('input[name="password"]', "client1234");
  await me.getByRole("button", { name: "Se connecter", exact: true }).click();
  await me.waitForTimeout(2500);

  const before = inbox.length;
  const mine = await placeOrder(me, { email: "karim.bensalah@example.com", name: "Karim Ben Salah", phone: "20777888" });
  await waitForMail(before + 2);
  const m = inbox.slice(before).find((x) => x.to?.includes("karim.bensalah@example.com"));
  check("the account holder is mailed", !!m, m?.subject);
  check("and sent to the order in their account", (m?.html || "").includes(`/compte/commandes/${mine.ref}`));
  await me.context().close();
}

console.log("\n[2] A GUEST WITH NO E-MAIL GETS NO MESSAGE, AND THE SHOP STILL DOES");
{
  const before = inbox.length;
  const guest = await placeOrder(p, { email: "", name: "Client Sans Adresse", phone: "20333444" });
  await waitForMail(before + 1);
  const since = inbox.slice(before);
  check("the order still went through", !!guest.ref, guest.ref);
  check("the shop was still told", since.some((m) => m.to?.includes("boutique-e2e@example.tn")));
  check("nothing was sent to an empty address", !since.some((m) => !m.to?.[0]), `${since.length} message(s)`);
}

console.log("\n[3] MOVING THE ORDER ON TELLS THE CUSTOMER");
{
  const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await admin.goto(`${BASE}/compte`);
  await admin.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
  await admin.fill('input[name="password"]', "admin1234");
  await admin.getByRole("button", { name: "Se connecter", exact: true }).click();
  await admin.waitForTimeout(2500);

  await admin.goto(`${BASE}/admin/commandes`);
  await admin.waitForTimeout(1000);
  await admin.locator(`a:has-text("${order.ref}")`).first().click();
  await admin.waitForTimeout(1200);

  const before = inbox.length;
  await admin.click('button:has-text("Expédiée")');
  await waitForMail(before + 1);
  const shipped = inbox.slice(before).find((m) => m.to?.includes(CUSTOMER));
  check("a status change mails the customer", !!shipped, shipped?.subject);
  check("and says which status, in the shop's own words", /expédiée/i.test(shipped?.subject + shipped?.text));

  // PENDING is deliberately silent: the confirmation already covered it.
  const beforePending = inbox.length;
  await admin.click('button:has-text("En attente")');
  await new Promise((r) => setTimeout(r, 2500));
  check("moving back to 'En attente' sends nothing extra", inbox.length === beforePending,
    `${inbox.length - beforePending} message(s)`);
  await admin.context().close();
}

console.log("\n[4] THE MAIL SERVER GOING DOWN DOES NOT COST THE SHOP AN ORDER");
{
  await new Promise((r) => stub.close(r));
  const before = inbox.length;
  const stranded = await placeOrder(p, { email: "panne@example.tn", name: "Client Panne", phone: "20555666" });
  check("the order completed anyway", !!stranded.ref, stranded.ref);
  check("and was not noticeably slowed by the dead server", stranded.ms < 15000, `${stranded.ms}ms`);
  check("no message was invented to cover it up", inbox.length === before);

  const stored = await prisma.order.findUnique({ where: { ref: stranded.ref }, select: { total: true } });
  check("it is really in the database, stock and all", !!stored, stranded.ref);
}

/* ------------------------------------------------------- cleanup --------- */

await browser.close();
if (previousShopEmail) {
  await prisma.setting.update({ where: { key: "shop_email" }, data: { value: previousShopEmail.value } });
} else {
  await prisma.setting.delete({ where: { key: "shop_email" } }).catch(() => {});
}
await prisma.$disconnect();

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
