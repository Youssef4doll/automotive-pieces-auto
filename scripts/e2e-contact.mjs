/**
 * The contact page, the shop's inbox, and the car an order was placed for.
 *
 * Two things the shop had no record of. Every "Contact" on the site was a
 * WhatsApp deep link, so a question asked lived on one phone and could not be
 * counted, handed over or produced later; and an order never said which car it
 * was for, so confirming it meant ringing the customer back to ask.
 *
 * Run against a production build — see run-e2e.sh.
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
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

const STAMP = Date.now();
const created = [];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

/* --------------------------------------------------------------- [1] ----- */
console.log("\n[1] THE CONTACT PAGE OFFERS BOTH CHANNELS, AND ONLY REAL DETAILS");
{
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await p.goto(`${BASE}/contact`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(600);

  // innerText, not textContent — the heading is `uppercase`, and Playwright
  // returns what is rendered.
  const h1 = (await p.locator("h1").first().innerText()).toLowerCase();
  check("the page exists and says what it is", h1.includes("besoin d'aide"), h1);
  check("there is a form to write in", (await p.locator('textarea[name="body"]').count()) === 1);
  check("and a subject list rather than a free-text line", (await p.locator('select[name="subject"]').count()) === 1);

  // WhatsApp is not replaced by the form, it is the first thing offered —
  // it is what Tunisian customers actually use.
  const settings = await prisma.setting.findMany({
    where: { key: { in: ["shop_whatsapp", "shop_phone", "shop_email", "shop_address", "shop_hours"] } },
  });
  const raw = (k) => settings.find((s) => s.key === k)?.value?.trim() || "";
  // The same rule settings.ts applies: a seeded "à compléter" marker or a run
  // of zeros is not a detail the shop has, and must never reach a page.
  const isPlaceholder = (v) =>
    !v || v.includes("à compléter") || v.includes("à-completer") || /^\+?[\s0]*$/.test(v.replace(/[()\-.]/g, ""));
  const real = (k) => (isPlaceholder(raw(k)) ? "" : raw(k));

  // Not "there must be a WhatsApp link": whether the shop has a usable number
  // is settings.ts's judgement (it also rejects the seeded default), and
  // restating that rule here would just be a second copy to keep in step. The
  // invariant worth holding is that a link, if drawn, points at the number in
  // the settings — and that the page always offers some way to reach the shop.
  const wa = p.locator('a[href*="wa.me"]');
  const waCount = await wa.count();
  if (waCount > 0) {
    const href = await wa.first().getAttribute("href");
    const digits = raw("shop_whatsapp").replace(/\D/g, "");
    check("the WhatsApp link points at the shop's own number", href.includes(digits), `${href} vs ${digits}`);
  } else {
    // Asked of the app rather than re-derived here: settings.ts decides what
    // counts as a usable number (it rejects the seeded default too), and a
    // second copy of that rule in a test is a second thing to keep in step.
    // The home page reads the same setting through the same helper, so if it
    // offers WhatsApp and this page does not, that is the bug worth catching.
    const home = await p.context().newPage();
    await home.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await home.waitForTimeout(500);
    const elsewhere = await home.locator('a[href*="wa.me"]').count();
    check("no WhatsApp here because the shop has none anywhere", elsewhere === 0,
      `${elsewhere} link(s) on the home page`);
    await home.close();
  }
  check("and there is always a way to write in", (await p.locator('form:has(textarea[name="body"])').count()) === 1);

  // Nothing invented: a detail appears only once the owner has entered a real
  // one, and a seeded placeholder must not leak onto a contact page — which is
  // the page where a fake telephone number does the most damage.
  const text = await p.locator("main").innerText();
  check("no placeholder detail leaks onto the page", !/à compléter|à-completer/i.test(text),
    (text.match(/.{0,30}à compléter.{0,20}/i) || ["none"])[0]);
  for (const key of ["shop_address", "shop_hours", "shop_phone", "shop_email"]) {
    const v = real(key);
    if (v) check(`${key} is shown as entered`, text.includes(v), v.slice(0, 40));
    else check(`${key} is omitted until it is real`, !text.includes(raw(key) || "\u0000"), `raw: "${raw(key).slice(0, 30)}"`);
  }
  await p.context().close();
}

/* --------------------------------------------------------------- [2] ----- */
console.log("\n[2] A MESSAGE LANDS IN THE SHOP'S INBOX, WITH ITS CONTEXT ATTACHED");
{
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  // Arriving from an order page: the reference and the part come along in the
  // query, and the car comes from the garage. The customer should not have to
  // retype any of the three.
  await p.goto(`${BASE}/contact?commande=CMD-QA-${STAMP}&ref=QA-SKU-${STAMP}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(700);

  // The contact form, not the header's search box — "form" matches both.
  const contactForm = p.locator('form:has(textarea[name="body"])');
  const joined = await contactForm.innerText();
  check("the page says what it is attaching", /Joint à votre message/i.test(joined), joined.split("\n").find((l) => l.includes("Joint")) ?? "");

  await p.fill('input[name="name"]', `QA Contact ${STAMP}`);
  await p.fill('input[name="email"]', `qa-contact-${STAMP}@example.test`);
  await p.selectOption('select[name="subject"]', "Compatibilité d'une pièce");
  await p.fill('textarea[name="body"]', `Message de test ${STAMP} — est-ce que cette pièce va sur ma voiture ?`);
  await p.click('button:has-text("Envoyer")');
  await p.waitForTimeout(1500);

  check("the customer is told it went", /Message envoyé/i.test(await p.locator("main").innerText()));

  const row = await prisma.contactMessage.findFirst({
    where: { email: `qa-contact-${STAMP}@example.test` },
  });
  if (row) created.push(row.id);
  check("it is a row in the shop's own inbox", !!row, row ? row.id : "nothing written");
  check("with the subject the customer picked", row?.subject === "Compatibilité d'une pièce", row?.subject ?? "");
  check("and the message itself", (row?.body ?? "").includes(String(STAMP)));
  check("the order reference came along", row?.orderRef === `CMD-QA-${STAMP}`, row?.orderRef ?? "(none)");
  check("so did the part reference", row?.productSku === `QA-SKU-${STAMP}`, row?.productSku ?? "(none)");
  check("it starts as unhandled", row?.status === "NEW", row?.status ?? "");
  await p.context().close();
}

/* --------------------------------------------------------------- [3] ----- */
console.log("\n[3] A BOT GETS THE THANK-YOU SCREEN AND NOTHING ELSE");
{
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await p.goto(`${BASE}/contact`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(600);
  const botEmail = `qa-bot-${STAMP}@example.test`;
  await p.fill('input[name="name"]', "QA Bot");
  await p.fill('input[name="email"]', botEmail);
  await p.fill('textarea[name="body"]', "Buy cheap watches now, definitely a real question about brakes.");
  // The trap is off-screen and out of the tab order; only a script fills it.
  await p.evaluate(() => {
    const trap = document.querySelector('input[name="company_website"]');
    if (trap) trap.value = "http://spam.example";
  });
  await p.click('button:has-text("Envoyer")');
  await p.waitForTimeout(1200);

  check("it is told the message went", /Message envoyé/i.test(await p.locator("main").innerText()));
  const row = await prisma.contactMessage.findFirst({ where: { email: botEmail } });
  if (row) created.push(row.id);
  check("but nothing was written", !row, row ? "a row was created" : "no row");
  await p.context().close();
}

/* --------------------------------------------------------------- [4] ----- */
console.log("\n[4] THE SHOP CAN SEE IT AND MARK IT TREATED");
{
  const admin = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await admin.goto(`${BASE}/compte`);
  await admin.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
  await admin.fill('input[name="password"]', "admin1234");
  await admin.getByRole("button", { name: "Se connecter", exact: true }).click();
  await waitForAdmin(admin, BASE);

  await admin.goto(`${BASE}/admin/messages`, { waitUntil: "domcontentloaded" });
  await admin.waitForTimeout(800);
  const card = admin.locator("article", { hasText: `QA Contact ${STAMP}` }).first();
  check("the message is on the inbox screen", (await card.count()) === 1);

  if ((await card.count()) === 1) {
    const cardText = await card.innerText();
    check("the customer's address is there to reply to", cardText.includes(`qa-contact-${STAMP}@example.test`));
    check("and the context it arrived with", cardText.includes(`CMD-QA-${STAMP}`), cardText.replace(/\n/g, " · ").slice(0, 120));

    await card.getByRole("button", { name: /Marquer traité/i }).click();
    await admin.waitForTimeout(1200);
    const row = await prisma.contactMessage.findFirst({ where: { email: `qa-contact-${STAMP}@example.test` } });
    check("marking it treated is recorded", row?.status === "HANDLED", row?.status ?? "");
    check("with the moment it happened", !!row?.handledAt);
  }
  await admin.context().close();
}

/* --------------------------------------------------------------- [5] ----- */
console.log("\n[5] AN ORDER RECORDS THE CAR, AND WHAT WE KNEW ABOUT EACH PART ON IT");
{
  // A part we hold a verified fitment for, and one we hold nothing for on the
  // same engine — so both branches of the verdict are exercised by one order
  // rather than asserted in the abstract.
  const known = await prisma.productFitment.findFirst({
    where: {
      confidence: "VERIFIED",
      product: { active: true, stockQty: { gte: 1 }, sku: { not: { startsWith: "PACK-" } } },
    },
    select: {
      engineId: true,
      product: { select: { id: true, slug: true, name: true } },
      engine: {
        select: { id: true, name: true, model: { select: { id: true, name: true, make: { select: { id: true, name: true } } } } },
      },
    },
  });

  if (!known) {
    console.log("  (no verified fitment on anything in stock — nothing to measure)");
  } else {
    const stranger = await prisma.product.findFirst({
      where: {
        active: true,
        stockQty: { gte: 1 },
        sku: { not: { startsWith: "PACK-" } },
        id: { not: known.product.id },
        fitments: { none: { engineId: known.engineId } },
      },
      select: { id: true, slug: true, name: true },
    });

    const veh = {
      makeId: known.engine.model.make.id,
      makeName: known.engine.model.make.name,
      modelId: known.engine.model.id,
      modelName: known.engine.model.name,
      engineId: known.engine.id,
      engineName: known.engine.name,
    };
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await ctx.addInitScript((v) => {
      localStorage.setItem("apa-vehicle", JSON.stringify({ state: { vehicles: [v], vehicle: v }, version: 0 }));
    }, veh);
    const p = await ctx.newPage();

    for (const prod of [known.product, stranger].filter(Boolean)) {
      await p.goto(`${BASE}/produit/${prod.slug}`, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(800);
      await p.getByRole("button", { name: /Ajouter au panier/i }).first().click();
      await p.waitForTimeout(700);
      // The stranger may be a part the catalogue lists for OTHER engines, in
      // which case the page now stops the first tap and asks. That is the
      // behaviour under test in e2e-audit-fixes; here it is a door to walk
      // through, because this suite is measuring what the ORDER records and
      // needs the line in the basket either way.
      const anyway = p.getByRole("button", { name: /Ajouter quand même/i });
      if (await anyway.count()) {
        await anyway.first().click();
        await p.waitForTimeout(700);
      }
    }

    await p.goto(`${BASE}/commande`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(800);
    await p.locator('input[autocomplete="name"]').first().fill(`QA Fit ${STAMP}`);
    await p.locator('input[autocomplete="tel"]').first().fill("20111444");
    await p.click('button:has-text("Ariana")');
    await p.waitForTimeout(250);
    await p.locator('[autocomplete="street-address"]').first().fill("3 rue du Fitment");
    await p.click('button:has-text("Confirmer la commande")');
    await p.waitForURL(/confirmation/, { timeout: 30000 });
    const ref = p.url().split("/").pop();

    const order = await prisma.order.findUnique({
      where: { ref },
      select: { vehicleLabel: true, vehicleEngineId: true, items: { select: { name: true, productId: true, fit: true } } },
    });

    const expected = `${veh.makeName} ${veh.modelName} ${veh.engineName}`;
    check("the order names the car", order?.vehicleLabel === expected, `"${order?.vehicleLabel}" vs "${expected}"`);
    check("and keeps the engine it points at", order?.vehicleEngineId === veh.engineId);

    const verified = order?.items.find((i) => i.productId === known.product.id);
    check("a part we hold a verified fitment for says so", verified?.fit === "VERIFIED", `${verified?.name}: ${verified?.fit}`);

    if (stranger) {
      const unlisted = order?.items.find((i) => i.productId === stranger.id);
      check("a part we hold nothing for is UNLISTED, not guessed at", unlisted?.fit === "UNLISTED", `${unlisted?.name}: ${unlisted?.fit}`);
    }

    // The label is read from our own tables, never from what the browser sent
    // — it goes on a delivery note.
    check("the label is our text, not the client's", !/undefined|null/.test(order?.vehicleLabel ?? ""), order?.vehicleLabel ?? "");
    await ctx.close();
  }
}

/* --------------------------------------------------------------- [6] ----- */
console.log("\n[6] AN ORDER WITHOUT A CAR SAYS SO, RATHER THAN GUESSING ONE");
{
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  const { findStockedProduct } = await import("./lib/stocked-product.mjs");
  const product = await findStockedProduct(prisma);
  if (!product) {
    console.log("  (nothing in stock — nothing to order)");
  } else {
    await p.goto(`${BASE}/produit/${product.slug}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(800);
    await p.getByRole("button", { name: /Ajouter au panier/i }).first().click();
    await p.waitForTimeout(700);
    await p.goto(`${BASE}/commande`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(800);
    await p.locator('input[autocomplete="name"]').first().fill(`QA NoCar ${STAMP}`);
    await p.locator('input[autocomplete="tel"]').first().fill("20111555");
    await p.click('button:has-text("Ariana")');
    await p.waitForTimeout(250);
    await p.locator('[autocomplete="street-address"]').first().fill("4 rue Sans Voiture");
    await p.click('button:has-text("Confirmer la commande")');
    await p.waitForURL(/confirmation/, { timeout: 30000 });
    const ref = p.url().split("/").pop();
    const order = await prisma.order.findUnique({
      where: { ref },
      select: { vehicleLabel: true, items: { select: { fit: true } } },
    });
    check("no car recorded when none was chosen", order?.vehicleLabel === null, String(order?.vehicleLabel));
    // Null, not UNLISTED: "we were not told" and "we hold no row" are
    // different facts and the shop acts on them differently.
    check("and no verdict is invented for the lines", order?.items.every((i) => i.fit === null), order?.items.map((i) => i.fit).join(", "));
  }
  await p.context().close();
}

/* ------------------------------------------------------------- cleanup --- */
if (created.length) {
  await prisma.contactMessage.deleteMany({ where: { id: { in: created } } });
}
const leftovers = await prisma.contactMessage.count({ where: { email: { contains: `-${STAMP}@example.test` } } });
check("no test message left behind", leftovers === 0, `${leftovers} remaining`);

await browser.close();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
