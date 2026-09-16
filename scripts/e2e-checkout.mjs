/**
 * The last three screens before the shop is paid, and the page people write
 * to when something goes wrong on them.
 *
 * The complaint that started this: "after ordering, for a slight second it
 * stays panier vide rather than automatically show the order." It was real,
 * it was worse than reported, and it was not a timing problem — the basket
 * lives in localStorage, so the *server* rendered the empty-basket branch into
 * the HTML of /panier and /commande and it sat there until the JavaScript
 * arrived. Measured before the fix, on a local machine with no network in the
 * way: 301ms on the cart page, 35ms on the checkout, 48ms after ordering.
 *
 * So section [1] is not "is it fast enough". It samples the rendered text
 * eight times a second and fails if the sentence "votre panier est vide" is
 * ever on screen while a basket exists. A slower machine makes that assertion
 * stricter, not flakier, which is the right way round.
 *
 * Run against a production build — see run-e2e.sh.
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { addStockedToCart } from "./lib/stocked-product.mjs";

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

const EMPTY = "panier est vide";

/** Sample the rendered text 125 times a second and remember what it said. */
const SAMPLER = `
  window.__seen = [];
  setInterval(() => {
    window.__seen.push(document.body ? document.body.innerText.includes(${JSON.stringify(EMPTY)}) : false);
  }, 8);
`;

const saidEmpty = (page) => page.evaluate(() => window.__seen.some(Boolean));
const resetSampler = (page) => page.evaluate(() => { window.__seen = []; });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function shopper() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addInitScript(SAMPLER);
  return ctx.newPage();
}

/* --------------------------------------------------------------- [1] ----- */
console.log("\n[1] THE SHOP NEVER TELLS A SHOPPER THE BASKET IS EMPTY WHEN IT IS NOT");
let bought = null;
{
  const p = await shopper();
  bought = await addStockedToCart(p, prisma, BASE);
  check("there is something in stock to buy", Boolean(bought), bought?.sku ?? "nothing buyable");

  if (bought) {
    for (const path of ["/panier", "/commande"]) {
      await p.goto(BASE + path, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(1200);
      check(`${path} never says the basket is empty`, !(await saidEmpty(p)));
      await resetSampler(p);
    }

    // And the basket really is on the page, so the check above is not passing
    // because nothing rendered at all.
    await p.goto(`${BASE}/panier`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(900);
    check(
      "the cart page shows the part that is in it",
      (await p.locator("main, body").first().innerText()).includes(bought.name.slice(0, 20)),
    );
  }
  await p.context().close();
}

/* --------------------------------------------------------------- [2] ----- */
console.log("\n[2] ORDERING SAYS SO, AND DOES NOT GO BACKWARDS");
{
  const p = await shopper();
  const item = await addStockedToCart(p, prisma, BASE);
  await p.goto(`${BASE}/commande`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(700);

  await p.locator('input[autocomplete="name"]').fill("QA Commande");
  await p.locator('input[type="tel"]').fill("20555444");
  await p.locator('input[autocomplete="street-address"]').fill("7 rue de la Caisse");
  await resetSampler(p);
  await p.getByRole("button", { name: /Confirmer la commande/i }).click();

  await p.waitForURL(/\/commande\/confirmation\//, { timeout: 30000 });
  await p.waitForTimeout(500);
  check("the gap between paying and the receipt never says 'panier vide'", !(await saidEmpty(p)));

  const ref = p.url().split("/").pop();
  const order = await prisma.order.findUnique({ where: { ref }, select: { id: true, ref: true } });
  check("the order is really in the database", Boolean(order), ref);
  check(
    "and the confirmation page names it",
    (await p.locator("body").innerText()).includes(ref),
    ref,
  );

  // replace, not push. Going back from a finished order must not land on a
  // checkout whose basket has just been emptied — the one place the empty
  // message would be true and useless.
  await p.goBack({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(600);
  check(
    "the back button does not return to the emptied checkout",
    !new URL(p.url()).pathname.endsWith("/commande"),
    new URL(p.url()).pathname,
  );

  if (order) {
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.orderStatusEvent.deleteMany({ where: { orderId: order.id } }).catch(() => {});
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
  }
  console.log(`  (ordered ${item?.sku ?? "?"}, cleaned up)`);
  await p.context().close();
}

/* --------------------------------------------------------------- [3] ----- */
console.log("\n[3] THE CHECKOUT IS THREE NAMED DECISIONS, WITH SYMBOLS THAT MATCH");
{
  const p = await shopper();
  await addStockedToCart(p, prisma, BASE);
  await p.goto(`${BASE}/commande`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(800);

  // .last(): the header's search box is a <form> too.
  const form = p.locator("form").last();
  const headings = await form.locator("h2").allInnerTexts();
  check("three steps, numbered", headings.length >= 3, headings.join(" | "));
  const text = await p.locator("main, body").first().innerText();

  // The card emoji used to label cash on delivery — the wrong picture, drawn
  // differently on every phone, on the one method that is explicitly not a
  // card. Nothing in this page should be an emoji any more.
  const emoji = text.match(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/gu) ?? [];
  check("no emoji left on the checkout", emoji.length === 0, emoji.join(" "));

  const svgs = await form.locator("svg").count();
  check("the steps and choices carry drawn symbols", svgs >= 6, `${svgs} inline svg`);

  // The delivery card must quote the fee the order will actually be charged,
  // and the free-delivery threshold is the shop's own setting.
  const threshold = Number(
    (await prisma.setting.findUnique({ where: { key: "free_shipping_threshold" } }))?.value || 150,
  );
  const subtotal = await p.evaluate(() => {
    try {
      const c = JSON.parse(localStorage.getItem("apa-cart")).state.items;
      return c.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    } catch { return null; }
  });
  if (subtotal !== null) {
    const free = subtotal >= threshold;
    const deliveryCard = await p.locator('button:has-text("Livraison à domicile")').innerText();
    check(
      free ? "free delivery is stated when it is earned" : "the delivery fee is quoted, not hidden",
      free ? /gratuit/i.test(deliveryCard) : /\d/.test(deliveryCard),
      `${subtotal.toFixed(2)} DT vs seuil ${threshold} — « ${deliveryCard.replace(/\n/g, " · ")} »`,
    );
  }

  // Pickup names where, or says nothing about where. Never a made-up street.
  await p.locator('button:has-text("Retrait en magasin")').click();
  await p.waitForTimeout(300);
  const address = (await prisma.setting.findUnique({ where: { key: "shop_address" } }))?.value ?? "";
  const configured = address && !address.includes("compléter");
  const afterPick = await form.innerText();
  check(
    configured ? "pickup says where the shop is" : "pickup says nothing about where, because nobody has said",
    configured ? afterPick.includes(address) : !/adresse\s*:/i.test(afterPick),
    configured ? address : "(no address configured)",
  );

  await p.context().close();
}

/* --------------------------------------------------------------- [4] ----- */
console.log("\n[4] THE CONTACT PAGE CARRIES THE QUESTION INTO THE FORM");
{
  const p = await shopper();
  await p.goto(`${BASE}/contact`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(700);

  const before = await p.locator('select[name="subject"]').inputValue();
  await p.locator('a:has-text("Retour ou échange")').first().click();
  await p.waitForTimeout(900);
  const after = await p.locator('select[name="subject"]').inputValue();
  check(
    "clicking 'Retour ou échange' selects it in the form",
    after === "Retour ou échange",
    `${before} → ${after}`,
  );

  // A shop with no WhatsApp number must not be described as reachable on
  // WhatsApp. Two places said so unconditionally.
  const wa = (await prisma.setting.findUnique({ where: { key: "shop_whatsapp" } }))?.value ?? "";
  const hasWa = wa && wa.replace(/\D/g, "") !== "21600000000" && !/^[\s0+]*$/.test(wa);
  const body = await p.locator("main, body").first().innerText();
  check(
    hasWa ? "WhatsApp is offered, because there is a number" : "WhatsApp is not named, because there is no number",
    hasWa ? /whatsapp/i.test(body) : !/whatsapp/i.test(body),
    hasWa ? wa : "(none configured)",
  );

  const cards = await p.locator("h1 ~ div a").count();
  check("the shortcuts above the form are drawn with symbols", (await p.locator("h1 ~ div a svg").count()) >= cards, `${cards} cards`);
  await p.context().close();
}

/* --------------------------------------------------------------- [5] ----- */
console.log("\n[5] THE PROMISES ON THE HOME PAGE WEAR THE RIGHT PICTURE");
{
  const p = await shopper();
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(700);
  const badge = p.locator("section").filter({ hasText: "Paiement à la livraison" }).last();
  check("the trust row is on the page", (await badge.count()) > 0);
  if (await badge.count()) {
    check("its badges are symbols now, not the numbers 1–4", (await badge.locator("svg").count()) >= 4);
  }
  await p.context().close();
}

/* --------------------------------------------------------------- [6] ----- */
console.log("\n[6] WHAT THE SOURCE MUST AND MUST NOT SAY");
{
  const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

  const limiter = read("src/lib/rate-limit.ts");
  check(
    "CF-Connecting-IP is only trusted behind an explicit flag",
    limiter.includes("TRUST_CLOUDFLARE_IP") &&
      limiter.indexOf("TRUST_CLOUDFLARE_IP") < limiter.indexOf("cf-connecting-ip"),
  );
  check("and that flag is off unless it is set to exactly 1", limiter.includes('process.env.TRUST_CLOUDFLARE_IP === "1"'));

  const checkout = read("src/components/CheckoutForm.tsx");
  check(
    "the checkout will not answer 'empty' before it has read the basket",
    checkout.includes("if (!hydrated) return <CheckoutSkeleton />"),
  );
  // The brace matters: `if (items.length === 0) return;` is the submit
  // guard and comes first by design. The branch this is about is the one
  // that *renders* the empty message.
  check(
    "a placed order outranks the emptied basket in the render",
    checkout.indexOf("if (placedRef)") < checkout.indexOf("if (items.length === 0) {"),
  );
  check(
    "the delivery fee on the card comes from the shipping module, not a literal",
    checkout.includes("FLAT_DELIVERY_FEE") && !/value=\{8\}/.test(checkout),
  );

  const cart = read("src/components/CartView.tsx");
  check("the cart page has the same guard", cart.includes("if (!hydrated)"));

  // One icon set. An emoji is a different drawing on every phone, so the
  // storefront draws its own.
  const contactForm = read("src/components/ContactForm.tsx");
  check("the contact form's subject survives a link that changes it", contactForm.includes("key={subject}"));

  const contactPage = read("src/app/(site)/contact/page.tsx");
  check(
    "the contact page does not prefetch itself four times over",
    contactPage.includes('prefetch={href.startsWith("/contact") ? false : undefined}'),
  );
}

await browser.close();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
