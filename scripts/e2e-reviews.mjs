/**
 * Reviews: who may write one, and who sees it when.
 *
 * The shop had none and no way to collect any. The risk in adding a box the
 * public can type into is that it becomes a spam surface and a rating that
 * means nothing, so there are two gates, and this suite exists to keep them
 * shut:
 *
 *  1. Only a customer with a DELIVERED order containing this exact part can
 *     review it — checked on the server, not just hidden in the UI.
 *  2. Nothing reaches the storefront, or the rating average in the structured
 *     data, until somebody at the shop has published it.
 *
 * The suite creates its own delivered order rather than relying on one being
 * there, and puts the data back afterwards.
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

const CUSTOMER = { email: "karim.bensalah@example.com", password: "client1234" };
const ADMIN = { email: "admin@automotive-pieces-auto.tn", password: "admin1234" };
const TEXT = `Avis e2e ${Date.now()} — montage sans surprise, qualité conforme.`;

// An order of this customer's, forced to DELIVERED so the entitlement exists.
// Its previous status is restored at the end.
// The product must still be active and still have a page: earlier suites in
// the battery deactivate and reactivate parts, and picking an arbitrary order
// found one whose product was switched off at that moment — the product page
// 404'd and the form was "missing" for a reason that had nothing to do with
// reviews. Ask for an order line whose product is live, and take the newest
// so the choice is deterministic rather than whatever the planner returns.
const order = await prisma.order.findFirst({
  where: {
    user: { email: CUSTOMER.email },
    items: { some: { product: { is: { active: true } } } },
  },
  orderBy: { createdAt: "desc" },
  select: {
    id: true,
    ref: true,
    status: true,
    items: { where: { product: { is: { active: true } } }, select: { productId: true }, take: 1 },
  },
});
if (!order) {
  console.log("  SKIP  the seeded customer has no order to work from");
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(0);
}
const productId = order.items[0].productId;
const product = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true, name: true } });
const previousStatus = order.status;

await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
// Start from nothing, so a re-run is not blocked by its own last review.
await prisma.review.deleteMany({ where: { productId } });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function signIn(page, who) {
  await page.goto(`${BASE}/compte`);
  await page.fill('input[name="email"]', who.email);
  await page.fill('input[name="password"]', who.password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForTimeout(2500);
}

const customer = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
await signIn(customer, CUSTOMER);

console.log("\n[1] ONLY SOMEBODY WHO RECEIVED THE PART IS OFFERED THE FORM");
{
  const other = await prisma.product.findFirst({
    where: { active: true, slug: { not: product.slug } },
    select: { slug: true },
  });
  await customer.goto(`${BASE}/produit/${other.slug}`, { waitUntil: "domcontentloaded" });
  await customer.waitForTimeout(700);
  check("no form on a part they never bought", (await customer.locator('input[name="rating"]').count()) === 0);

  const landed = await customer.goto(`${BASE}/produit/${product.slug}`, { waitUntil: "domcontentloaded" });
  await customer.waitForTimeout(800);
  // Distinguishes "the form is missing" from "the page is missing" — the
  // second is somebody else's suite having switched the part off, and it
  // should not be reported as a review bug.
  check("the part's page is up", landed?.status() === 200, `HTTP ${landed?.status()} for ${product.slug}`);
  check("the form is there on the part they received", (await customer.locator('input[name="rating"]').count()) === 5, product.name);

  // The rating input is deliberately sr-only with a visible star as its
  // label — a star widget made of divs is invisible to a keyboard.
  const isRadio = await customer.locator('input[name="rating"]').first().getAttribute("type");
  check("the stars are real radio inputs, not divs", isRadio === "radio", isRadio);
}

console.log("\n[2] A SUBMITTED REVIEW WAITS FOR THE SHOP");
{
  await customer.locator('label:has(input[name="rating"][value="4"])').click();
  await customer.fill("textarea", TEXT);
  await customer.click('button:has-text("Publier mon avis")');
  await customer.waitForTimeout(2500);
  check("the customer is told it was received and is awaiting review",
    (await customer.locator("text=Merci").count()) > 0);

  const row = await prisma.review.findFirst({ where: { productId }, select: { published: true, verified: true, rating: true } });
  check("it is stored unpublished", row?.published === false);
  check("and marked as a verified purchase by the server", row?.verified === true);
  check("with the rating that was chosen", row?.rating === 4, String(row?.rating));

  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`${BASE}/produit/${product.slug}`, { waitUntil: "domcontentloaded" });
  await anon.waitForTimeout(700);
  const html = await anon.evaluate(() => document.body.innerHTML);
  check("the public cannot see it yet", !html.includes(TEXT));
  // An unpublished review must not move the rating in the structured data
  // either — that is what search engines quote back at people.
  check("and it is not in the page's structured data", !/"aggregateRating"/.test(html));
  await anon.context().close();
}

console.log("\n[3] PUBLISHING IT PUTS IT ON THE PAGE");
{
  const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await signIn(admin, ADMIN);
  await admin.goto(`${BASE}/admin/avis`, { waitUntil: "domcontentloaded" });
  await admin.waitForTimeout(1000);

  const queue = await admin.evaluate(() => document.body.innerText);
  check("the queue says how many are waiting", /attend/.test(queue), (queue.match(/[^\n]*attend[^\n]*/) || [])[0]);
  check("and shows what the customer wrote", queue.includes(TEXT.slice(0, 30)));

  await admin.click('button:has-text("Publier")');
  await admin.waitForTimeout(2500);

  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`${BASE}/produit/${product.slug}`, { waitUntil: "domcontentloaded" });
  await anon.waitForTimeout(900);
  const text = await anon.evaluate(() => document.body.innerText);
  check("the public sees it once published", text.includes(TEXT.slice(0, 30)));
  check("shown as a verified purchase", text.includes("Achat vérifié"));
  await anon.context().close();
  await admin.context().close();
}

console.log("\n[4] ONE REVIEW PER CUSTOMER PER PART");
{
  await customer.goto(`${BASE}/produit/${product.slug}`, { waitUntil: "domcontentloaded" });
  await customer.waitForTimeout(800);
  check("the form is not offered a second time", (await customer.locator('input[name="rating"]').count()) === 0);
}

/* ------------------------------------------------------------ cleanup ---- */

await browser.close();
await prisma.review.deleteMany({ where: { productId } });
await prisma.order.update({ where: { id: order.id }, data: { status: previousStatus } });
await prisma.$disconnect();

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
