/**
 * The seven behaviours a second audit found missing, each measured where it
 * failed.
 *
 * Every one of these was reported as a thing a shopper did and the site got
 * wrong — a basket holding 13 of something with 8 on the shelf, an "Ajouter au
 * panier" fully enabled on a part the page had just called incompatible, a
 * guest with no way back to their own order, a confirmation that arrived with
 * the footer on screen, a sign-out that left the next person the basket, a
 * form that refused in silence, and no measurement at all.
 *
 * They were fixed and verified by hand in a browser. This suite is what keeps
 * them fixed: seven regressions that would each pass every other suite in the
 * battery, because nothing else asserts any of it.
 *
 * Two of them are narrow on purpose and the narrowness is checked from both
 * sides, since a rule that fires on everything is a different bug from the one
 * it replaced:
 *
 *  - the add-to-cart gate fires when the part HAS fitment data and this engine
 *    is not in it, and does not fire when the shop has recorded nothing;
 *  - the stock clamp caps at the shelf, and does not cap a "sur commande"
 *    part — whose shelf is zero — at zero.
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const STAMP = Date.now();
const EMAIL = `qa-audit-${STAMP}@example.test`;
const PASSWORD = "audit1234";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

/** Seed a basket straight into localStorage, the way a returning visit has one. */
async function seedCart(ctx, items) {
  await ctx.addInitScript((payload) => {
    localStorage.setItem("apa-cart", JSON.stringify({ state: { items: payload }, version: 0 }));
  }, items);
}

/** Read the store back out of localStorage after zustand has rehydrated. */
async function storedCart(page) {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("apa-cart") ?? "{}")?.state?.items ?? [];
    } catch {
      return [];
    }
  });
}

const cartLine = (p, qty) => ({
  productId: p.id,
  name: p.name,
  sku: p.sku,
  slug: p.slug,
  imageUrl: p.imageUrl ?? "",
  unitPrice: Number(p.priceSell),
  qty,
  stockQty: p.stockQty,
});

/* --------------------------------------------------------------- [1] ----- */
console.log("\n[1] A BASKET RESTORED FROM STORAGE CANNOT ASK FOR MORE THAN THE SHELF HOLDS");
{
  const shelf = await prisma.product.findFirst({
    where: { active: true, stockQty: { gte: 2, lte: 60 }, sku: { not: { startsWith: "PACK-" } } },
    select: { id: true, slug: true, name: true, sku: true, imageUrl: true, priceSell: true, stockQty: true },
  });
  // A part with an empty shelf that the shop still sells — "sur commande".
  // Its cap is a sane basket size, not its stock count, and the two cases are
  // what separates a clamp from a bug.
  const onOrder = await prisma.product.findFirst({
    where: { active: true, stockQty: 0, supply: "ON_ORDER", sku: { not: { startsWith: "PACK-" } } },
    select: { id: true, slug: true, name: true, sku: true, imageUrl: true, priceSell: true, stockQty: true },
  });

  if (!shelf) {
    console.log("  (nothing in stock to measure against)");
  } else {
    const lines = [cartLine(shelf, shelf.stockQty + 5)];
    if (onOrder) lines.push(cartLine(onOrder, 40));

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await seedCart(ctx, lines);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/panier`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1200);

    const after = await storedCart(p);
    const stocked = after.find((i) => i.productId === shelf.id);
    check(
      "a line written when the shelf was fuller is capped on the way in",
      stocked?.qty === shelf.stockQty,
      `${shelf.name}: asked ${shelf.stockQty + 5}, holds ${stocked?.qty} of ${shelf.stockQty}`,
    );

    // The visible half: what the shopper reads has to agree with what the
    // store holds, or the clamp has only moved the lie.
    const shown = await p.locator("main").innerText();
    check(
      "and the page does not print the number it refused",
      !new RegExp(`\\b${shelf.stockQty + 5}\\b`).test(shown.replace(/\s+/g, " ")),
      `looked for ${shelf.stockQty + 5}`,
    );

    if (onOrder) {
      const backorder = after.find((i) => i.productId === onOrder.id);
      check(
        "a part that is ordered in is NOT capped at its empty shelf",
        backorder?.qty === 40,
        `${onOrder.name}: ${backorder?.qty}`,
      );
    }

    // Pressing "−" once now walks down from the shelf, not from the number
    // that was stored. This is the exact symptom that was reported: the
    // stepper appeared to jump 13 → 8, because the clamp had never run.
    const dec = p.getByRole("button", { name: /Diminuer|Decrease|réduire/i }).first();
    if (await dec.count()) {
      await dec.click();
      await p.waitForTimeout(600);
      const stepped = (await storedCart(p)).find((i) => i.productId === shelf.id);
      check(
        "and one press of − steps down from the shelf, not from the stored number",
        stepped?.qty === Math.max(1, shelf.stockQty - 1),
        `${stepped?.qty}`,
      );
    }
    await ctx.close();
  }
}

/* --------------------------------------------------------------- [2] ----- */
console.log("\n[2] A PART THE SHOP'S OWN DATA SAYS IS FOR ANOTHER CAR ASKS BEFORE IT GOES IN");
{
  // A product with fitment rows, and an engine that is not one of them: the
  // narrow case where the shop actually knows the answer is no.
  //
  // Searched over candidates rather than taking the first row, because the
  // first row is a trap. Inside the battery this section quietly measured
  // NOTHING — "no product with fitment rows and a car outside them" — for one
  // reason: `findFirst` happened to return an oil filter listed for 24 of the
  // shop's 25 engines, and a sixty-line section reported itself as fine by
  // reporting nothing. Fewest fitments first is both the likeliest mismatch
  // and a stable choice.
  const candidates = await prisma.product.findMany({
    where: {
      active: true,
      stockQty: { gte: 1 },
      sku: { not: { startsWith: "PACK-" } },
      fitments: { some: {} },
    },
    select: { id: true, slug: true, name: true, sku: true, fitments: { select: { engineId: true } } },
    orderBy: { fitments: { _count: "asc" } },
    take: 25,
  });
  const engines = await prisma.vehicleEngine.findMany({
    select: {
      id: true,
      name: true,
      model: { select: { id: true, name: true, make: { select: { id: true, name: true } } } },
    },
  });

  let listed = null;
  let stranger = null;
  for (const c of candidates) {
    const known = new Set(c.fitments.map((f) => f.engineId));
    const outside = engines.find((e) => !known.has(e.id));
    if (outside) {
      listed = c;
      stranger = outside;
      break;
    }
  }

  if (!listed || !stranger) {
    // A FAIL, not a note. This section is the whole reason the suite exists,
    // and a shop where it cannot run is a shop whose compatibility gate is
    // untested — which is exactly the state it was in when it shipped broken.
    check(
      "there is a part with fitment data and a car outside it to measure against",
      false,
      `${candidates.length} candidate(s), ${engines.length} engine(s)`,
    );
  } else {
    const veh = {
      makeId: stranger.model.make.id,
      makeName: stranger.model.make.name,
      modelId: stranger.model.id,
      modelName: stranger.model.name,
      engineId: stranger.id,
      engineName: stranger.name,
    };
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
    await ctx.addInitScript((v) => {
      localStorage.setItem("apa-vehicle", JSON.stringify({ state: { vehicles: [v], vehicle: v }, version: 0 }));
    }, veh);
    const p = await ctx.newPage();

    await p.goto(`${BASE}/produit/${listed.slug}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1100);
    await p.getByRole("button", { name: /Ajouter au panier/i }).first().click();
    await p.waitForTimeout(700);

    const dialog = p.locator('[role="alertdialog"]');
    check("the first tap opens the question instead of adding", (await dialog.count()) > 0);
    check("and the basket is still empty", (await storedCart(p)).length === 0);
    check(
      "the free check is offered beside it",
      (await dialog.getByRole("link").count()) > 0,
      `${await dialog.getByRole("link").count()} link(s)`,
    );

    // The door is not locked: the shopper can see the part and we cannot.
    await p.getByRole("button", { name: /Ajouter quand même/i }).first().click();
    await p.waitForTimeout(800);
    const afterConfirm = await storedCart(p);
    check(
      "pressing on anyway does add it",
      afterConfirm.some((i) => i.productId === listed.id),
      `${afterConfirm.length} line(s)`,
    );

    // The bar at the bottom of a phone buys the same product and must not buy
    // it under different rules. It called the cart store directly, so for the
    // four fifths of the scroll where it is the only buy button the confirm
    // above did not exist.
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await phone.addInitScript((v) => {
      localStorage.setItem("apa-vehicle", JSON.stringify({ state: { vehicles: [v], vehicle: v }, version: 0 }));
    }, veh);
    const m = await phone.newPage();
    await m.goto(`${BASE}/produit/${listed.slug}`, { waitUntil: "domcontentloaded" });
    await m.waitForTimeout(1200);
    await m.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await m.waitForTimeout(900);
    const bar = m.locator("[data-bottom-bar] button").first();
    if (await bar.count()) {
      await bar.click();
      await m.waitForTimeout(800);
      check(
        "the sticky bar on a phone asks the same question",
        (await m.locator('[role="alertdialog"]').count()) > 0 && (await storedCart(m)).length === 0,
      );
      const anyway = m.getByRole("button", { name: /Ajouter quand même/i }).first();
      if (await anyway.count()) {
        await anyway.click();
        await m.waitForTimeout(800);
        check("and takes the same answer", (await storedCart(m)).some((i) => i.productId === listed.id));
      }
    } else {
      check("the sticky bar on a phone asks the same question", false, "no bar at 390px to measure");
    }
    await phone.close();

    // The other side of the rule. "We have not checked" is not "it does not
    // fit", and gating on it would put a warning across most of the catalogue.
    const noData = await prisma.product.findFirst({
      where: { active: true, stockQty: { gte: 1 }, sku: { not: { startsWith: "PACK-" } }, fitments: { none: {} } },
      select: { id: true, slug: true, name: true },
    });
    if (noData) {
      const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 950 } });
      await ctx2.addInitScript((v) => {
        localStorage.setItem("apa-vehicle", JSON.stringify({ state: { vehicles: [v], vehicle: v }, version: 0 }));
      }, veh);
      const q = await ctx2.newPage();
      await q.goto(`${BASE}/produit/${noData.slug}`, { waitUntil: "domcontentloaded" });
      await q.waitForTimeout(1100);
      await q.getByRole("button", { name: /Ajouter au panier/i }).first().click();
      await q.waitForTimeout(800);
      check(
        "a part we have recorded nothing for keeps its ordinary button",
        (await q.locator('[role="alertdialog"]').count()) === 0 &&
          (await storedCart(q)).some((i) => i.productId === noData.id),
        noData.name,
      );
      await ctx2.close();
    }

    // The card carries the same verdict, but sends the decision to the page
    // that can explain it rather than putting a dialog on every tile.
    await p.goto(`${BASE}/recherche?q=${encodeURIComponent(listed.sku)}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1300);
    // With a car saved the results hide what does not fit it, so the card
    // under test is behind the shop's own escape hatch — which is where a
    // shopper meets it too.
    const showAll = p.getByRole("button", { name: /Voir toutes les références/i }).first();
    check("a saved car hides what does not fit, but says so and offers the rest", (await showAll.count()) > 0);
    if (await showAll.count()) {
      await showAll.click();
      await p.waitForTimeout(1200);
    }
    // Walked up from the product's own link rather than guessing at the card's
    // markup: the tile is a plain <div>, so there is no element to name.
    const card = await p.evaluate((slug) => {
      const link = document.querySelector(`main a[href="/produit/${slug}"]`);
      if (!link) return null;
      for (let el = link.parentElement; el && el !== document.body; el = el.parentElement) {
        const action = el.querySelector("a,button");
        const texts = [...el.querySelectorAll("a,button")].map((n) => n.textContent?.trim() ?? "");
        if (texts.some((t) => /Ajouter au panier|Vérifier avant d'acheter/i.test(t))) {
          return {
            check: texts.some((t) => /Vérifier avant d'acheter/i.test(t)),
            add: [...el.querySelectorAll("button")].some((n) => /Ajouter au panier/i.test(n.textContent ?? "")),
            first: action?.textContent?.trim() ?? "",
          };
        }
      }
      return null;
    }, listed.slug);
    check(
      "its card offers the check, not the button",
      !!card && card.check && !card.add,
      card ? JSON.stringify(card) : `no card for ${listed.sku} in the results`,
    );
    await ctx.close();
  }
}

/* --------------------------------------------------------------- [3] ----- */
// One guest checkout, driven from the bottom of the form, serves three of the
// findings at once: the scroll position after ordering, the messages the form
// gives when it refuses, and the order a guest then has to find again.
console.log("\n[3] THE FORM SAYS WHAT IS WRONG, IN FRENCH, ON EVERY FIELD AT ONCE");
let placedRef = null;
let placedPhone = "20445566";
{
  const buyable = await prisma.product.findFirst({
    where: { active: true, stockQty: { gte: 2 }, sku: { not: { startsWith: "PACK-" } } },
    orderBy: { stockQty: "desc" },
    select: { id: true, slug: true, name: true, sku: true, imageUrl: true, priceSell: true, stockQty: true },
  });

  if (!buyable) {
    console.log("  (nothing buyable — no checkout to measure)");
  } else {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await seedCart(ctx, [cartLine(buyable, 1)]);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/commande`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1300);

    const form = p.locator('form:has(input[name="phone"])').first();
    // `noValidate` is the whole reason any of this is reachable: the browser
    // blocks the submit event entirely while a required field is empty, so the
    // form's own handler never ran and no French message could ever have been
    // printed.
    check("the form hands the verdict to the page", await form.evaluate((f) => f.noValidate));

    await form.getByRole("button", { name: /Confirmer la commande/i }).click();
    await p.waitForTimeout(700);
    const empty = await form.locator('[role="alert"]').allInnerTexts();
    check(
      "an empty form names every missing field, not one bubble",
      empty.filter((m) => /obligatoire/i.test(m)).length >= 3,
      `${empty.length} message(s)`,
    );
    check("and says so once at the button", empty.some((m) => /Il manque quelque chose/i.test(m)));
    check("and does not leave the checkout", new URL(p.url()).pathname === "/commande");

    // A filled-in form that is still wrong gets the reason, not the same
    // sentence again.
    await p.locator('input[name="name"]').fill("QA Audit");
    await p.locator('input[name="phone"]').fill("12");
    await p.locator('input[name="email"]').fill("pas-une-adresse@");
    await p.waitForTimeout(200);
    await form.getByRole("button", { name: /Confirmer la commande/i }).click();
    await p.waitForTimeout(700);
    const junk = (await form.locator('[role="alert"]').allInnerTexts()).join(" | ");
    check("a short number is told it is short", /trop court/i.test(junk), junk.slice(0, 120));
    check("a broken e-mail is told it is not an address", /n'est pas valide/i.test(junk));

    // Autofill was quietly broken too: not one of these inputs carried a name.
    const named = await form.evaluate((f) =>
      ["name", "phone", "email", "address"].filter((n) => f.querySelector(`[name="${n}"]`) !== null),
    );
    check("every field a browser could fill has a name", named.length === 4, named.join(", "));

    console.log("\n[4] THE ANSWER ARRIVES AT THE TOP OF THE PAGE");
    await p.locator('input[name="phone"]').fill(placedPhone);
    await p.locator('input[name="email"]').fill("");
    await p.click('button:has-text("Ariana")');
    await p.waitForTimeout(300);
    await p.locator('[name="address"]').first().fill("12 rue de l'Audit");
    // Press from where a shopper presses: the bottom of a long form on a
    // phone. That is what produced a confirmation opened at the footer.
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(300);
    const before = await p.evaluate(() => window.scrollY);
    check("the shopper is at the bottom of the form when they confirm", before > 200, `${before}px`);

    await form.getByRole("button", { name: /Confirmer la commande/i }).click();
    await p.waitForURL(/confirmation/, { timeout: 30000 });
    await p.waitForTimeout(1200);
    const landed = await p.evaluate(() => window.scrollY);
    check("the confirmation opens at the top", landed < 50, `${landed}px`);

    const h1 = await p.locator("h1").first().innerText();
    check("and the first thing on it is the answer", h1.length > 0, h1.slice(0, 60));

    placedRef = p.url().split("/").pop();
    const body = await p.locator("main").innerText();
    check("it tells the guest to keep the number", /Gardez ce numéro/i.test(body));
    check("and links to where it is used", (await p.locator('main a[href="/suivi"]').count()) > 0);
    await ctx.close();
  }
}

/* --------------------------------------------------------------- [5] ----- */
console.log("\n[5] A GUEST CAN FIND THAT ORDER AGAIN — WITH THE PHONE, AND ONLY WITH IT");
if (!placedRef) {
  console.log("  (no order was placed above — nothing to look up)");
} else {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();

  // A browser that did not place it cannot open it. That is the rule the
  // lookup has to get past honestly.
  const resp = await p.goto(`${BASE}/commande/confirmation/${placedRef}`, { waitUntil: "domcontentloaded" });
  check("a browser that did not place the order cannot open it", resp?.status() === 404, `HTTP ${resp?.status()}`);

  await p.goto(`${BASE}/suivi`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(900);
  // Checked here rather than on the 404 above: `app/not-found.tsx` sits above
  // the site layout and renders no footer at all.
  check("the footer points at the tracker", (await p.locator('footer a[href="/suivi"]').count()) > 0);
  const lookup = p.locator('form:has(input[name="ref"])').first();
  check("and the tracker asks for nothing but the number and the phone", (await lookup.count()) > 0);

  // The wrong phone on a real reference, and a reference that does not exist,
  // must be indistinguishable — otherwise the form is a way to discover which
  // references are real, one request at a time.
  await p.locator('input[name="ref"]').fill(placedRef);
  await p.locator('input[name="phone"]').fill("29000000");
  await lookup.getByRole("button").click();
  await p.waitForTimeout(1400);
  const wrongPhone = await lookup.locator('[role="alert"]').innerText();
  check("a wrong phone is refused", wrongPhone.length > 0, wrongPhone.slice(0, 80));

  await p.locator('input[name="ref"]').fill("CMD-000000");
  await lookup.getByRole("button").click();
  await p.waitForTimeout(1400);
  const unknownRef = await lookup.locator('[role="alert"]').innerText();
  check("an unknown reference is refused in exactly the same words", unknownRef === wrongPhone);
  check("and neither answer confirms the reference exists", !unknownRef.includes(placedRef));

  await p.locator('input[name="ref"]').fill(placedRef);
  await p.locator('input[name="phone"]').fill(placedPhone);
  await lookup.getByRole("button").click();
  await p.waitForURL(/confirmation/, { timeout: 20000 });
  await p.waitForTimeout(900);
  const opened = await p.locator("main").innerText();
  check("the right pair opens the order", p.url().includes(placedRef) && opened.includes(placedRef), placedRef);

  // The lookup mints the same cookie checkout does, so everything downstream
  // of the confirmation page — the tracker, the totals, the printable document
  // — works from here exactly as it does straight after ordering.
  const again = await p.goto(`${BASE}/commande/confirmation/${placedRef}`, { waitUntil: "domcontentloaded" });
  check("and this browser keeps it afterwards", again?.status() === 200, `HTTP ${again?.status()}`);
  await ctx.close();
}

/* --------------------------------------------------------------- [6] ----- */
console.log("\n[6] SIGNING OUT LEAVES THE NEXT PERSON NOTHING");
{
  // Created directly rather than through the signup form: this suite is about
  // what logout clears, and the signup limiter is a budget the battery shares.
  const user = await prisma.user.create({
    data: {
      name: "QA Audit",
      email: EMAIL,
      phone: "20445566",
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      role: "CUSTOMER",
    },
    select: { id: true },
  });

  const buyable = await prisma.product.findFirst({
    where: { active: true, stockQty: { gte: 1 }, sku: { not: { startsWith: "PACK-" } } },
    orderBy: { stockQty: "desc" },
    select: { id: true, slug: true, name: true, sku: true, imageUrl: true, priceSell: true, stockQty: true },
  });
  const engine = await prisma.vehicleEngine.findFirst({
    select: { id: true, name: true, model: { select: { id: true, name: true, make: { select: { id: true, name: true } } } } },
  });

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (buyable) await seedCart(ctx, [cartLine(buyable, 1)]);
  if (engine) {
    await ctx.addInitScript((v) => {
      localStorage.setItem("apa-vehicle", JSON.stringify({ state: { vehicles: [v], vehicle: v }, version: 0 }));
    }, {
      makeId: engine.model.make.id,
      makeName: engine.model.make.name,
      modelId: engine.model.id,
      modelName: engine.model.name,
      engineId: engine.id,
      engineName: engine.name,
    });
  }
  const p = await ctx.newPage();

  await p.goto(`${BASE}/compte`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(700);
  await p.fill('input[name="email"]', EMAIL);
  await p.fill('input[name="password"]', PASSWORD);
  await p.getByRole("button", { name: "Se connecter", exact: true }).click();
  await p.waitForTimeout(2500);

  await p.goto(`${BASE}/compte/profil`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  const signedIn = !p.url().includes("/compte?") && (await p.locator("main").innerText()).length > 0;
  check("signed in on a shared phone, with a basket and a car saved", signedIn);

  const garageBefore = await p.evaluate(
    () => JSON.parse(localStorage.getItem("apa-vehicle") ?? "{}")?.state?.vehicles?.length ?? 0,
  );
  const cartBefore = (await storedCart(p)).length;

  await p.getByRole("button", { name: /Se déconnecter/i }).first().click();
  await p.waitForTimeout(2500);

  const cartAfter = await storedCart(p);
  const garageAfter = await p.evaluate(
    () => JSON.parse(localStorage.getItem("apa-vehicle") ?? "{}")?.state?.vehicles?.length ?? 0,
  );
  check("the basket goes with it", cartAfter.length === 0, `${cartBefore} → ${cartAfter.length}`);
  check("and so does every saved car, not just the active one", garageAfter === 0, `${garageBefore} → ${garageAfter}`);

  // The server half. `logout()` lands on the home page, so the question is not
  // where the browser is but whether the profile is still reachable.
  await p.goto(`${BASE}/compte/profil`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1000);
  check(
    "and the session with it — the profile asks for a password again",
    (await p.locator('input[name="password"]').count()) > 0,
    p.url().replace(BASE, ""),
  );

  await ctx.close();
  await prisma.cart.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

/* --------------------------------------------------------------- [7] ----- */
console.log("\n[7] ANALYTICS IS ONE SWITCH, READ IN EVERY PLACE THAT DEPENDS ON IT");
{
  const { readFile } = await import("node:fs/promises");
  const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
  const sources = {
    "the script": "src/components/GoogleAnalytics.tsx",
    "the security policy": "src/proxy.ts",
    "the privacy page": "src/app/(site)/confidentialite/page.tsx",
  };
  for (const [what, file] of Object.entries(sources)) {
    check(`${what} reads NEXT_PUBLIC_GA_ID`, (await read(file)).includes("NEXT_PUBLIC_GA_ID"), file);
  }

  // Google's tag is the SECOND analytics on this site and must not have
  // replaced the first. It nearly did: the GA component was written as
  // `Analytics.tsx`, which is the name of the shop's own page-view recorder
  // feeding /admin/analytics — the file was overwritten, the internal counter
  // went silent, and /confidentialite went on promising "une mesure
  // d'audience interne". Every other suite passed.
  check(
    "the shop's own page-view recorder is still the one in the root layout",
    (await read("src/components/Analytics.tsx")).includes("page_view") &&
      (await read("src/app/layout.tsx")).includes("<Analytics />"),
  );
  check(
    "and Google's is separate, and only over the storefront",
    (await read("src/app/(site)/layout.tsx")).includes("<GoogleAnalytics />") &&
      !(await read("src/app/layout.tsx")).includes("GoogleAnalytics"),
  );

  // Whichever side this server is running, both halves have to agree — a page
  // that loads Google under a policy that forbids it is a blank console error,
  // and a policy opened for a script that is not there is a widened policy for
  // nothing.
  const on = !!process.env.NEXT_PUBLIC_GA_ID?.trim();
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  // Measured, not read off the source: a component can be mounted and still
  // record nothing.
  const before = await prisma.analyticsEvent.count({ where: { name: "page_view" } });
  const resp = await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const csp = resp?.headers()["content-security-policy"] ?? "";
  await p.waitForTimeout(1500);
  const tags = await p.evaluate(
    () => [...document.querySelectorAll("script[src]")].filter((s) => s.src.includes("googletagmanager")).length,
  );

  const after = await prisma.analyticsEvent.count({ where: { name: "page_view" } });
  check("a visit is still recorded in the shop's own table", after > before, `${before} → ${after}`);

  check(`this server has analytics ${on ? "ON" : "OFF"} — the page agrees`, on ? tags > 0 : tags === 0, `${tags} tag(s)`);
  check(
    "and the policy agrees with the page",
    on ? /connect-src[^;]*google-analytics/.test(csp) : /connect-src 'self';/.test(csp),
    csp.match(/connect-src[^;]*/)?.[0] ?? "(no connect-src)",
  );
  check(
    "img-src moves with it",
    on ? /img-src[^;]*google/.test(csp) : !/img-src[^;]*google/.test(csp),
    csp.match(/img-src[^;]*/)?.[0] ?? "(no img-src)",
  );
  if (on) {
    // Under a nonce-based policy a script without this request's nonce is
    // refused by the browser, silently, and the shop measures nothing.
    const nonced = await p.evaluate(
      () => [...document.querySelectorAll("script")].filter((s) => s.id?.startsWith("ga-") && s.nonce).length,
    );
    check("both GA tags carry the request's nonce", nonced >= 2, `${nonced}`);
  }
  await ctx.close();
}

await browser.close();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
