/**
 * Security regression suite.
 *
 * Every check here corresponds to a control that can silently stop working:
 * a header dropped from the config, an ownership check refactored away, a
 * rate limit whose window was widened. They assert behaviour through HTTP and
 * a real browser, not by reading the source.
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
const EMAIL = `sec.${STAMP}@example.com`;
const PASSWORD = "client1234";

/**
 * The reference API's limiter is per-address and lives in the server process,
 * so a suite run within a minute of the previous one starts with the window
 * already spent. Wait it out rather than reporting a working limiter as a
 * broken endpoint.
 */
async function awaitFreshWindow(page, base) {
  const probe = await page.request.get(`${base}/api/reference?q=GDB1330`);
  if (probe.status() !== 429) return;
  const wait = (Number(probe.headers()["retry-after"]) || 60) + 2;
  console.log(`      rate-limit window already spent; waiting ${wait}s`);
  await new Promise((r) => setTimeout(r, wait * 1000));
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();

// ---------------------------------------------------------------- headers
console.log("\n[1] SECURITY HEADERS ON EVERY HTML RESPONSE");
{
  const res = await p.request.get(`${BASE}/`, { maxRedirects: 0 });
  const h = res.headers();
  check("Content-Security-Policy is set", Boolean(h["content-security-policy"]));
  const csp = h["content-security-policy"] ?? "";
  check("CSP script-src uses a nonce, not 'unsafe-inline'",
        /script-src[^;]*'nonce-/.test(csp) && !/script-src[^;]*'unsafe-inline'/.test(csp));
  check("CSP forbids framing", /frame-ancestors 'none'/.test(csp));
  check("CSP pins object-src to none", /object-src 'none'/.test(csp));
  check("HSTS is set with a long max-age",
        /max-age=(\d+)/.test(h["strict-transport-security"] ?? "") &&
        Number(RegExp.$1) >= 31536000);
  check("MIME sniffing is off", h["x-content-type-options"] === "nosniff");
  check("Referrer policy is set", Boolean(h["referrer-policy"]));
  check("X-Frame-Options backs up frame-ancestors", h["x-frame-options"] === "DENY");
  check("Permissions-Policy is set", Boolean(h["permissions-policy"]));
  check("the framework version banner is gone", !("x-powered-by" in h));
}

console.log("\n[2] THE NONCE IS FRESH PER REQUEST");
{
  const a = await p.request.get(`${BASE}/`, { maxRedirects: 0 });
  const b = await p.request.get(`${BASE}/`, { maxRedirects: 0 });
  const one = (a.headers()["content-security-policy"] ?? "").match(/'nonce-([^']+)'/)?.[1];
  const two = (b.headers()["content-security-policy"] ?? "").match(/'nonce-([^']+)'/)?.[1];
  check("two requests get different nonces", Boolean(one) && Boolean(two) && one !== two);
}

// ------------------------------------------------------------ rate limits
console.log("\n[3] THE PUBLIC LOOKUP API VALIDATES ITS INPUT");
{
  // Validation is asserted before the rate-limit budget is spent — exhausting
  // it first (as an earlier version of this suite did) makes every later
  // request a 429 and the assertions meaningless.
  await awaitFreshWindow(p, BASE);

  const short = await p.request.get(`${BASE}/api/reference?q=a`);
  check("a too-short reference is answered without a lookup",
        short.status() === 200 && (await short.json()).found === false);

  const long = "x".repeat(5000);
  const oversized = await p.request.get(`${BASE}/api/reference?q=${encodeURIComponent(long)}`);
  check("an oversized reference is rejected",
        oversized.status() === 200 && (await oversized.json()).found === false);

  const sqlish = await p.request.get(`${BASE}/api/reference?q=${encodeURIComponent("' OR 1=1 --")}`);
  check("a SQL-shaped reference finds nothing and does not error",
        sqlish.status() === 200 && (await sqlish.json()).found === false);

  const unknown = await p.request.get(`${BASE}/api/reference?q=zzz-not-a-reference`);
  check("an unknown reference resolves to nothing", (await unknown.json()).found === false);
}

console.log("\n[4] LOGIN IS RATE LIMITED");
{
  const c = await browser.newContext();
  const lp = await c.newPage();
  let sawLimit = false;
  for (let i = 0; i < 12 && !sawLimit; i++) {
    await lp.goto(`${BASE}/compte`);
    await lp.fill('input[name="email"]', `nobody.${STAMP}@example.com`);
    await lp.fill('input[name="password"]', `wrong-${i}`);
    await lp.getByRole("button", { name: "Se connecter", exact: true }).click();
    await lp.waitForTimeout(700);
    if (/Trop de tentatives/i.test(await lp.locator("main").innerText())) sawLimit = true;
  }
  check("repeated wrong passwords are eventually refused outright", sawLimit);
  await c.close();
}

// -------------------------------------------------------- bot protection
console.log("\n[5] BOT PROTECTION ON PUBLIC FORMS");
{
  const c = await browser.newContext();
  const bp = await c.newPage();
  await bp.goto(`${BASE}/compte`);
  await bp.getByRole("button", { name: /Créer un compte|S'inscrire/i }).first().click().catch(() => {});
  await bp.waitForTimeout(400);
  const honeypot = bp.locator('input[name="company_website"]');
  check("the signup form carries a honeypot", (await honeypot.count()) > 0);
  check("the honeypot is out of the tab order", (await honeypot.first().getAttribute("tabindex")) === "-1");
  check("the honeypot is hidden from assistive tech",
        (await bp.locator('[aria-hidden="true"] input[name="company_website"]').count()) > 0);
  check("the form stamps a load time", (await bp.locator('input[name="form_loaded_at"]').count()) > 0);

  // Fill the trap and submit: the account must not be created.
  const trapped = `trap.${STAMP}@example.com`;
  await bp.fill('input[name="name"]', "Bot Script").catch(() => {});
  await bp.fill('input[name="email"]', trapped).catch(() => {});
  await bp.fill('input[name="phone"]', "20000000").catch(() => {});
  await bp.fill('input[name="password"]', PASSWORD).catch(() => {});
  await bp.locator('input[name="company_website"]').first().fill("http://spam.example", { force: true });
  await bp.getByRole("button", { name: /Créer mon compte|Créer un compte|S'inscrire/i }).last().click().catch(() => {});
  await bp.waitForTimeout(1200);
  const created = await prisma.user.findUnique({ where: { email: trapped } });
  check("a submission that fills the honeypot creates no account", created === null);
  await c.close();
}

// ------------------------------------------------------- record access
console.log("\n[6] ORDERS ARE NOT READABLE BY REFERENCE ALONE");
{
  const other = await prisma.order.findFirst({
    select: { ref: true, id: true, customerName: true, phone: true, items: { select: { name: true } } },
  });
  const anon = await browser.newContext();
  const ap = await anon.newPage();
  const res = await ap.request.get(`${BASE}/commande/confirmation/${other.ref}`, { maxRedirects: 0 });
  check("a stranger cannot open someone's order confirmation", res.status() === 404, `status=${res.status()}`);
  // Assert on the order's private fields rather than on a UI phrase or on the
  // reference. Translated strings can legitimately contain "Commande
  // confirmée", and the reference is in the URL the caller just typed — so
  // neither proves anything. The customer's name, phone and basket do.
  const body = await res.text();
  check("and the customer's name does not appear", !body.includes(other.customerName));
  check("and their phone number does not appear", !body.includes(other.phone));
  check("and none of the parts they bought appear",
        other.items.every((i) => !body.includes(i.name)));
  await anon.close();
}

console.log("\n[7] THE ACCOUNT AREA SCOPES ORDERS TO THEIR OWNER");
{
  await p.goto(`${BASE}/compte`);
  await p.getByRole("button", { name: /Créer un compte|S'inscrire/i }).first().click().catch(() => {});
  await p.waitForTimeout(400);
  await p.fill('input[name="name"]', "Sécurité Test");
  await p.fill('input[name="email"]', EMAIL);
  await p.fill('input[name="phone"]', "20111222");
  await p.fill('input[name="password"]', PASSWORD);
  await p.waitForTimeout(2200); // clear the "too fast" threshold like a person
  await p.getByRole("button", { name: /Créer mon compte|Créer un compte|S'inscrire/i }).last().click();
  await p.waitForTimeout(2500);
  check("a genuine signup still succeeds", /compte/.test(p.url()));

  const foreign = await prisma.order.findFirst({
    where: { NOT: { user: { email: EMAIL } } },
    select: { ref: true },
  });
  const res = await p.request.get(`${BASE}/compte/commandes/${foreign.ref}`, { maxRedirects: 0 });
  check("another customer's order is not found", res.status() === 404, `status=${res.status()}`);
}

console.log("\n[8] SESSION COOKIE FLAGS");
{
  const cookies = await ctx.cookies();
  const session = cookies.find((c) => c.name.includes("apa_session"));
  check("the session cookie exists", Boolean(session));
  check("it is httpOnly", session?.httpOnly === true);
  check("it is sameSite Lax or stricter", ["Lax", "Strict"].includes(session?.sameSite ?? ""));
  check("it is scoped to the whole site", session?.path === "/");
  const readable = await p.evaluate(() => document.cookie);
  check("script cannot read it", !readable.includes("apa_session"));
}

console.log("\n[9] NO SECRETS OR PASSWORD HASHES REACH THE BROWSER");
{
  for (const route of ["/", "/compte", "/panier"]) {
    const html = await (await p.request.get(`${BASE}${route}`)).text();
    check(`no bcrypt hash in ${route}`, !/\$2[aby]\$\d\d\$/.test(html));
    check(`no database URL in ${route}`, !html.includes("postgresql://"));
  }
}

console.log("\n[10] WITHDRAWN PRODUCTS ARE NOT SELLABLE");
{
  const sellable = await prisma.product.findFirst({
    where: { active: true, stockQty: { gt: 0 } },
    select: { id: true, slug: true },
  });
  check("a sellable product exists to test against", Boolean(sellable));

  const inactive = await prisma.product.findFirst({ where: { active: false }, select: { slug: true } });
  if (inactive) {
    const res = await p.request.get(`${BASE}/produit/${inactive.slug}`, { maxRedirects: 0 });
    check("a deactivated product has no public page", res.status() === 404, `status=${res.status()}`);
  } else {
    console.log("      (no inactive product in the catalogue to check)");
  }
}

console.log("\n[11] THE ADMIN AREA IS CLOSED TO CUSTOMERS");
{
  const routes = ["/admin", "/admin/stock", "/admin/commandes", "/admin/parametres", "/admin/import"];
  for (const r of routes) {
    const res = await p.request.get(`${BASE}${r}`, { maxRedirects: 0 });
    check(`a signed-in customer is turned away from ${r}`, res.status() === 307 || res.status() === 302,
          `status=${res.status()}`);
  }
  const anon = await browser.newContext();
  const res = await (await anon.newPage()).request.get(`${BASE}/admin`, { maxRedirects: 0 });
  check("so is a signed-out visitor", res.status() === 307 || res.status() === 302, `status=${res.status()}`);
  await anon.close();
}

console.log("\n[12] THE PUBLIC LOOKUP API IS RATE LIMITED");
{
  // Last, because it deliberately exhausts the window for this address. If a
  // previous run already spent the budget, wait it out rather than asserting
  // against an exhausted limiter and calling that a failure.
  await awaitFreshWindow(p, BASE);

  let limited = 0;
  let ok = 0;
  for (let i = 0; i < 70; i++) {
    const r = await p.request.get(`${BASE}/api/reference?q=GDB1330`);
    if (r.status() === 429) limited++;
    else if (r.status() === 200) ok++;
  }
  check("it serves a bounded number of lookups then refuses", limited > 0 && ok > 0,
        `${ok} served, ${limited} refused`);
  const r = await p.request.get(`${BASE}/api/reference?q=GDB1330`);
  check("the refusal tells the caller when to retry", Boolean(r.headers()["retry-after"]));
}

// cleanup
await prisma.order.deleteMany({ where: { user: { email: EMAIL } } });
await prisma.cart.deleteMany({ where: { user: { email: EMAIL } } });
await prisma.user.deleteMany({ where: { email: { in: [EMAIL, `trap.${STAMP}@example.com`] } } });

await browser.close();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
