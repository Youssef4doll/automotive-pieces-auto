/**
 * Searching the way the shop's own customers type.
 *
 * The catalogue is written in French. Its customers are Tunisian, and they
 * type "debriyaj" for an embrayage, "zit" for oil, and دبرياج or فلتر الزيت
 * on an Arabic keyboard — on a site that ships an Arabic translation and a
 * language switcher offering it.
 *
 * None of that used to work. Arabic was worse than unhelpful: `fold()` kept
 * only [a-z0-9], so an Arabic query folded to the empty string, returned
 * nothing, and was not even recorded as a missed search — the shop could not
 * see that anyone had asked.
 *
 * These checks drive the real search box. They assert the local wording
 * reaches the same parts the French wording does, that an Arabic query
 * naming a car still finds the part, and — the part that matters most for a
 * shop deciding what to stock — that a local word for something the shop does
 * NOT sell is logged as unmet demand rather than silently swallowed.
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

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

/** The part slugs a query returns, in order. */
async function results(q) {
  await page.goto(`${BASE}/recherche?q=${encodeURIComponent(q)}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  return page.$$eval('main a[href^="/produit/"]', (as) => [
    ...new Set(as.map((a) => a.getAttribute("href"))),
  ]);
}

console.log("\n[1] THE FRENCH WORDING IS THE BASELINE");
const baseline = {};
for (const [label, q] of [
  ["huile moteur", "huile moteur"],
  ["filtre à huile", "filtre a huile"],
  ["plaquettes", "plaquettes de frein"],
  ["bougies", "bougie"],
  ["amortisseurs", "amortisseur"],
  ["embrayage", "kit d embrayage"],
]) {
  baseline[label] = await results(q);
  check(`"${q}" finds parts`, baseline[label].length > 0, `${baseline[label].length} result(s)`);
}

console.log("\n[2] THE SAME PARTS, TYPED THE WAY THEY ARE SAID HERE");
for (const [q, expected] of [
  ["zit", "huile moteur"],
  ["filtre zit", "filtre à huile"],
  ["blaket", "plaquettes"],
  ["bouji", "bougies"],
  ["amortisour", "amortisseurs"],
  ["debriyaj", "embrayage"],
]) {
  const got = await results(q);
  check(
    `"${q}" reaches the same parts as "${expected}"`,
    got.length > 0 && got.every((h) => baseline[expected].includes(h)),
    `${got.length} result(s)`
  );
}

console.log("\n[3] AND TYPED IN ARABIC");
for (const [q, expected] of [
  ["زيت المحرك", "huile moteur"],
  ["فلتر الزيت", "filtre à huile"],
  ["بلاكات", "plaquettes"],
  ["بوجي", "bougies"],
  ["مساعدات", "amortisseurs"],
  ["دبرياج", "embrayage"],
]) {
  const got = await results(q);
  check(
    `"${q}" reaches the same parts as "${expected}"`,
    got.length > 0 && got.every((h) => baseline[expected].includes(h)),
    `${got.length} result(s)`
  );
}

console.log("\n[4] A CAR NAMED IN ARABIC DOES NOT BLANK THE PAGE");
{
  // The catalogue spells cars in Latin, so an Arabic model name can never
  // match the index. It must narrow or be ignored — never turn a good query
  // into no results at all.
  const withCar = await results("فلتر الزيت كليو");
  check("an Arabic model name still returns the part", withCar.length > 0, `${withCar.length} result(s)`);
  check("and stays within what the plain query returns",
    withCar.every((h) => baseline["filtre à huile"].includes(h)));

  const unknownWord = await results("فلتر الزيت شيء غريب");
  check("an unrecognised Arabic word does not blank the page either",
    unknownWord.length > 0, `${unknownWord.length} result(s)`);
}

console.log("\n[5] WHAT THE SHOP DOES NOT SELL IS LOGGED, NOT SWALLOWED");
{
  const term = `قطعة${Date.now()}`;
  await prisma.searchMiss.deleteMany({ where: { query: term } }).catch(() => {});
  const got = await results(term);
  check("an Arabic query for something we do not stock returns nothing", got.length === 0);
  await page.waitForTimeout(1200);
  const logged = await prisma.searchMiss.findFirst({ where: { query: term } });
  check("and lands in the shop's unmet-demand list", !!logged, logged?.normalized);
  if (logged) await prisma.searchMiss.delete({ where: { id: logged.id } });
}

console.log("\n[6] THE FINDER SAYS THE SEARCH UNDERSTANDS IT");
{
  await page.goto(`${BASE}/#finder`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /Je sais quelle pièce/ }).click();
  await page.waitForTimeout(300);
  const panel = await page.locator("#finder").innerText();
  check("the part-name route invites local wording", /debriyaj/i.test(panel), (panel.match(/[^\n]*debriyaj[^\n]*/i) || [])[0]);

  await page.getByRole("button", { name: /Je connais ma voiture/ }).click();
  await page.waitForTimeout(300);
  const carPanel = await page.locator("#finder").innerText();
  check("and the vehicle route points at the carte grise", /carte grise/i.test(carPanel));
}

await browser.close();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
