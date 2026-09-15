/**
 * The deep-analysis page, the paged buying list, and the thing that actually
 * matters about both: that an admin reading them does not slow the shop down.
 *
 * The owner's constraint, in their words: "keep in mind the data doesn't make
 * the server slow as it's going to be used by customers." The admin and the
 * storefront share one database and one connection pool, so the check that
 * counts is not "does the page load" — it is whether the storefront still
 * answers at its normal speed while somebody is hammering the analytics.
 * Section [4] measures exactly that.
 *
 * Run against a production build — see run-e2e.sh.
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
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

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const admin = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
admin.on("pageerror", (e) => console.log("  PAGE ERROR:", e.message));
await admin.goto(`${BASE}/compte`);
await admin.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
await admin.fill('input[name="password"]', "admin1234");
await admin.getByRole("button", { name: "Se connecter", exact: true }).click();
await waitForAdmin(admin, BASE);

/* --------------------------------------------------------------- [1] ----- */
console.log("\n[1] THE PAGE IS THERE, IT IS ADMIN-ONLY, AND EVERY PANEL DREW");
{
  const shopper = await (await browser.newContext()).newPage();
  const res = await shopper.goto(`${BASE}/admin/analyse`, { waitUntil: "domcontentloaded" });
  check("a visitor never reaches it", !shopper.url().includes("/admin/analyse") || (res?.status() ?? 0) >= 400,
    `landed on ${shopper.url().replace(BASE, "")}`);
  await shopper.context().close();

  await admin.goto(`${BASE}/admin/analyse`, { waitUntil: "networkidle" });
  await admin.waitForTimeout(500);
  const text = await admin.locator("main").innerText();

  check("the heading is the deep page", (await admin.locator("h1").first().innerText()).includes("ANALYSE"));
  for (const panel of [
    "Tendance et projection",
    "Où les visiteurs s'arrêtent",
    "À réapprovisionner",
    "Ce qui fait le chiffre",
    "Stock dormant",
    "D'où viennent les commandes",
    "Les voitures qu'on sert vraiment",
    "Commandes à vérifier avant expédition",
    "Demande non satisfaite",
    "Nouveaux et fidèles",
    "Où on livre",
  ]) {
    check(`panel: ${panel}`, text.toUpperCase().includes(panel.toUpperCase()));
  }
  check("nothing rendered as NaN or undefined", !/NaN|undefined|Infinity/.test(text),
    (text.match(/.{0,30}(NaN|undefined|Infinity).{0,20}/) || ["clean"])[0]);
}

/* --------------------------------------------------------------- [2] ----- */
console.log("\n[2] THE PROJECTION SAYS WHAT IT IS, OR REFUSES");
{
  const panel = admin.locator("section", { hasText: "TENDANCE ET PROJECTION" }).first();
  const text = await panel.innerText();
  const days = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT date_trunc('day', "createdAt")) AS d
    FROM "Order"
    WHERE "createdAt" >= NOW() - INTERVAL '90 days' AND "status" <> 'CANCELLED'
  `;
  const orderDays = Number(days[0]?.d ?? 0);

  if (orderDays >= 14) {
    // A projection is allowed, and must carry its method and its range — a
    // single confident number with no band is the dishonest version of this.
    check("it states the method it used", /[Rr]égression linéaire/.test(text), text.split("\n").at(-1) ?? "");
    check("and gives a range, not one confident number", /–|—/.test(text) && /DT/.test(text));
  } else {
    check("it refuses rather than projecting from nothing", /[Pp]as encore assez d'historique/.test(text),
      `${orderDays} order-day(s) in the window`);
  }

  // Whatever it says, it must never claim to be a sales forecast.
  check("it never calls itself a sales forecast", /n'est pas une\s+prévision de ventes/.test(text.replace(/\s+/g, " ")) || /pas une prévision/.test(text.replace(/\s+/g, " ")));
}

/* --------------------------------------------------------------- [3] ----- */
console.log("\n[3] THE BUYING LIST IS NOT READ UNTIL IT IS ASKED FOR");
{
  const outstanding = await prisma.searchMiss.findMany({
    where: { resolvedAt: null },
    orderBy: [{ count: "desc" }, { lastSeenAt: "desc" }],
    select: { query: true },
    take: 50,
  });

  // The server HTML must carry the totals and the button, and none of the rows.
  const html = await (await fetch(`${BASE}/admin/analyse`, {
    headers: { cookie: (await admin.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") },
  })).text();

  if (outstanding.length === 0) {
    console.log("  (no outstanding search misses — nothing to page)");
  } else {
    check("the first render ships no rows at all",
      !outstanding.some((m) => html.includes(`« ${m.query} »`)),
      `${outstanding.length} outstanding, none in the HTML`);
    check("but it says how many there are", /Voir la liste/.test(html));

    const panel = admin.locator("section", { hasText: "DEMANDE NON SATISFAITE" }).first();
    await panel.getByRole("button", { name: /Voir la liste/i }).click();
    await admin.waitForTimeout(1200);
    const rows = await panel.locator("li").count();
    check("pressing it loads a page of rows", rows > 0 && rows <= 10, `${rows} row(s)`);

    const total = outstanding.length;
    if (total > 10) {
      check("and there is a pager when there is more than one page", await panel.getByRole("button", { name: /Suivant/i }).count() === 1);
      const firstBefore = await panel.locator("li").first().innerText();
      await panel.getByRole("button", { name: /Suivant/i }).click();
      await admin.waitForTimeout(1200);
      check("next turns the page", (await panel.locator("li").first().innerText()) !== firstBefore);
    } else {
      check("no pager when everything fits on one page",
        (await panel.getByRole("button", { name: /Suivant/i }).count()) === 0, `${total} line(s)`);
    }
  }
}

/* --------------------------------------------------------------- [4] ----- */
console.log("\n[4] AN ADMIN READING ANALYTICS DOES NOT SLOW THE SHOP DOWN");
{
  // The measurement the owner asked for. Time the storefront on its own, then
  // time it again while the analytics page is being loaded over and over, and
  // compare. A page of unbounded aggregates shows up here as the second number
  // coming back several times the first.
  const cookie = (await admin.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");

  const timeOnce = async (url, headers = {}) => {
    const t = Date.now();
    const res = await fetch(url, { headers });
    await res.arrayBuffer();
    return Date.now() - t;
  };
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

  // Warm both paths first so neither number is a cold start.
  await timeOnce(`${BASE}/`);
  await timeOnce(`${BASE}/admin/analyse`, { cookie });

  const quiet = [];
  for (let i = 0; i < 9; i++) quiet.push(await timeOnce(`${BASE}/`));
  const quietMedian = median(quiet);

  const busy = [];
  const hammer = (async () => {
    for (let i = 0; i < 12; i++) await timeOnce(`${BASE}/admin/analyse`, { cookie });
  })();
  for (let i = 0; i < 9; i++) busy.push(await timeOnce(`${BASE}/`));
  await hammer;
  const busyMedian = median(busy);

  // Threefold is a deliberately loose ceiling: this runs on one shared box
  // with the database, the app and the browser on it, so the number is noisy.
  // What it catches is the failure mode that matters — a page whose reads are
  // unbounded takes the storefront from tens of milliseconds to seconds.
  check(
    "the storefront keeps its speed while the analytics page is hammered",
    busyMedian <= Math.max(150, quietMedian * 3),
    `home ${quietMedian}ms quiet → ${busyMedian}ms under load (12 analytics loads)`,
  );

  // And the page itself has to be usable, not merely survivable.
  const analyse = [];
  for (let i = 0; i < 5; i++) analyse.push(await timeOnce(`${BASE}/admin/analyse`, { cookie }));
  check("and the analytics page itself answers quickly", median(analyse) < 2000, `${median(analyse)}ms median`);
}

/* --------------------------------------------------------------- [5] ----- */
console.log("\n[5] THE READS ARE BOUNDED BY CONSTRUCTION, NOT BY LUCK");
{
  // A source check, because this is the property that has to survive the next
  // person adding a panel. Timing tells you today's answer; this tells you the
  // rule was kept.
  // Comments stripped first. Both of the checks below are about what the code
  // *does*, and both files explain in prose the exact pattern they replaced —
  // so a naive grep matches the warning against doing it and fails the file
  // for documenting itself.
  const decomment = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const src = decomment(readFileSync(new URL("../src/lib/data/deep-analytics.ts", import.meta.url), "utf8"));

  // Every raw SELECT either aggregates to a handful of rows or names a LIMIT.
  const selects = src.split(/prisma\.\$queryRaw/).slice(1);
  const unbounded = selects
    .map((chunk) => chunk.slice(0, chunk.indexOf("`,") > 0 ? chunk.indexOf("`,") : 600))
    .filter((q) => !/LIMIT/i.test(q) && !/COUNT\(|SUM\(|generate_series/i.test(q));
  check("every raw query is aggregated or limited", unbounded.length === 0,
    unbounded.length ? unbounded[0].slice(0, 90).replace(/\s+/g, " ") : `${selects.length} raw queries, all bounded`);

  // And every one of them is filtered by a date window.
  const windowless = selects
    .map((chunk) => chunk.slice(0, chunk.indexOf("`,") > 0 ? chunk.indexOf("`,") : 600))
    .filter((q) => /FROM "(Order|AnalyticsEvent|OrderItem)"/.test(q) && !/Since|createdAt/.test(q));
  check("and every order or event read is inside a date window", windowless.length === 0,
    windowless.length ? windowless[0].slice(0, 90).replace(/\s+/g, " ") : "all windowed");

  // The pattern this page exists to replace: pulling rows to count them in JS.
  check("nothing pulls rows just to count them in JavaScript",
    !/findMany\([^)]*distinct/s.test(src) && !/take:\s*1000/.test(src));

  // The cache is the other half of the bargain.
  check("the whole read sits behind one cache entry", /unstable_cache\(readDeepAnalytics/.test(src));
  check("with a tag and a lifetime from lib/cache", /ANALYTICS_TTL/.test(src) && /ANALYTICS_TAG/.test(src));

  // The old analytics page's unbounded session read is gone too.
  const adminSrc = decomment(readFileSync(new URL("../src/lib/data/admin.ts", import.meta.url), "utf8"));
  check("the older analytics page no longer pulls every session id",
    !/distinct:\s*\["sessionId"\]/.test(adminSrc));

  // The dashboard was the worst of the three: every order, every order line
  // and every product, loaded on each view of the page the shop leaves open
  // all day. Every findMany left in this file must name a take.
  const takeless = [...adminSrc.matchAll(/prisma\.\w+\.findMany\(\{[\s\S]{0,400}?\}\)/g)]
    .map((m) => m[0])
    .filter((q) => !/take:\s*\d+/.test(q));
  check("every dashboard list read names a take", takeless.length === 0,
    takeless.length ? takeless[0].slice(0, 100).replace(/\s+/g, " ") : "all bounded");
}

await browser.close();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
