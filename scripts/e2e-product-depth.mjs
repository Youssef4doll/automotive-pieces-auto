/**
 * What a parts page has to say before somebody will buy from it.
 *
 * Five things the product page could not do, checked end to end:
 *
 *   - an OE number could be stored but not attributed, so the page printed a
 *     row of digits belonging to nobody. They are grouped by the carmaker that
 *     stamps them now, and each one is a link to its own reference page;
 *   - the shop had nowhere to record who actually made a part, so a customer
 *     with a defective one had no manufacturer to write to;
 *   - the car picker asked for the motorisation — the one field most drivers
 *     cannot answer — without first asking petrol or diesel, which all of them
 *     can;
 *   - the compatibility list was a table printed whole, unsearchable at the
 *     size a real catalogue reaches;
 *   - and nothing on the page said what "compatible" is actually worth.
 *
 * The rule the whole suite exists to hold: none of this may invent anything.
 * A part with no OE numbers prints no OE section, a brand with no address
 * prints no manufacturer panel, and a fuel step appears only for a model the
 * shop recorded with more than one fuel.
 *
 * Run against a production build — see run-e2e.sh.
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { waitForAdmin } from "./lib/wait-for-admin.mjs";
import { pickOption } from "./lib/pick-option.mjs";

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

const STAMP = Date.now().toString(36).toUpperCase();
const SKU = `QA-OE-${STAMP}`;
const BRAND_NAME = `QA Fabricant ${STAMP}`;

// The numbers the part is given. Two carmakers with their own, one number that
// genuinely belongs to two of them — PSA stamps the same part for Citroën and
// Peugeot — and one with nobody's name on it.
const SHARED = "1611349280";
const OEM_TEXT = [
  `RENAULT: 77 01 234 ${STAMP.slice(0, 3)}, 8200123456`,
  `PEUGEOT: ${SHARED}`,
  `CITROËN: ${SHARED}`,
  "9XW358053261",
].join("\n");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
const page = await ctx.newPage();

async function signIn(p) {
  await p.goto(`${BASE}/compte`, { waitUntil: "domcontentloaded" });
  await p.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
  await p.fill('input[name="password"]', "admin1234");
  // Exact, because "Connexion" is also the name of the tab above the form.
  await p.getByRole("button", { name: "Se connecter", exact: true }).click();
  await waitForAdmin(p, BASE);
}

let productSlug = null;
let brandId = null;

try {
  await signIn(page);

  /* ------------------------------------------------------------- [1] ----- */
  console.log("\n[1] THE ADMIN CAN SAY WHOSE NUMBER EACH OE REFERENCE IS");
  {
    // The brand first, so the product can be filed under it and the
    // manufacturer panel has something to print. Driven through the form the
    // shop actually uses rather than written straight into the table.
    await page.goto(`${BASE}/admin/catalogue/marques`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /nouvelle marque/i }).click();
    await page.waitForTimeout(400);

    const form = page.locator("form").filter({ has: page.locator('input[name="legalName"]') }).first();
    check("the brand form offers the manufacturer fields", (await form.count()) === 1);
    // Folded on a brand that has none — eight boxes filled once and then left
    // alone should not be the first thing between an admin and a brand name.
    check("folded until asked for", !(await form.locator("details").evaluate((el) => el.open)));
    await form.locator("details summary").click();
    await page.waitForTimeout(250);

    await form.locator('input[name="name"]').fill(BRAND_NAME);
    await form.locator('input[name="legalName"]').fill("QA Fabrication GmbH & Co. KG");
    await form.locator('input[name="street"]').fill("Rixbecker Str. 75");
    await form.locator('input[name="postalCode"]').fill("59552");
    await form.locator('input[name="city"]').fill("Lippstadt");
    await form.locator('input[name="country"]').fill("Allemagne");
    await form.locator('input[name="phone"]').fill("+49 2941 / 38 - 0");
    await form.locator('input[name="email"]').fill("qa@example.com");
    await form.locator('input[name="website"]').fill("www.example.com/");
    await form.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForTimeout(1800);

    const brand = await prisma.brand.findFirst({ where: { name: BRAND_NAME } });
    brandId = brand?.id ?? null;
    check("the brand is saved with its manufacturer details", !!brand);
    check("including the registered name", brand?.legalName === "QA Fabrication GmbH & Co. KG");
    check("the address", brand?.street === "Rixbecker Str. 75" && brand?.postalCode === "59552");
    check("and the ways to reach them", brand?.phone?.includes("2941") && brand?.email === "qa@example.com");

    // Now the part, with its OE numbers attributed line by line.
    const cat = await prisma.category.findFirst({
      where: { parentId: { not: null } },
      select: { id: true, name: true },
    });
    await page.goto(`${BASE}/admin/stock/nouveau`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    await page.fill('input[name="sku"]', SKU);
    await page.fill('input[name="name"]', `Balai d'essuie-glace QA ${STAMP}`);
    await pickOption(page, "categoryId", cat.name);
    await pickOption(page, "brandId", BRAND_NAME);
    await page.fill('textarea[name="oemRefsText"]', OEM_TEXT);
    await page.fill('input[name="priceBuy"]', "9");
    await page.fill('input[name="priceSell"]', "19");
    await page.fill('input[name="stockQty"]', "5");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForTimeout(2500);

    const created = await prisma.product.findUnique({
      where: { sku: SKU },
      select: {
        id: true,
        slug: true,
        oemRefs: true,
        references: { select: { type: true, brand: true, raw: true, normalized: true } },
      },
    });
    productSlug = created?.slug ?? null;
    check("the part is filed", !!created, created?.slug);

    const oem = (created?.references ?? []).filter((r) => r.type === "OEM");
    check("every OE number is stored", oem.length === 5, `${oem.length} row(s)`);
    check(
      "each one under the carmaker that was typed beside it",
      oem.filter((r) => r.brand === "RENAULT").length === 2 &&
        oem.some((r) => r.brand === "PEUGEOT") &&
        oem.some((r) => r.brand === "CITROËN"),
      oem.map((r) => `${r.brand || "—"}:${r.normalized}`).join(" "),
    );
    // The reason the unique key had to change: one number, two owners, two rows.
    check(
      "the same number under two carmakers is kept twice, not collapsed",
      oem.filter((r) => r.normalized === SHARED).length === 2,
    );
    check(
      "a line with no carmaker is kept, unattributed rather than guessed",
      oem.some((r) => r.brand === "" && r.normalized === "9XW358053261"),
    );
    // The flat array the search index and the structured data read used to be
    // left behind by this form entirely.
    check(
      "the product's own reference list is written too, not left behind",
      (created?.oemRefs ?? []).length === 5 &&
        created.oemRefs.some((r) => r.replace(/\D/g, "") === SHARED),
      (created?.oemRefs ?? []).join(" | "),
    );
  }

  /* ------------------------------------------------------------- [2] ----- */
  console.log("\n[2] THE PRODUCT PAGE GROUPS THEM, AND EVERY NUMBER IS A SEARCH");
  {
    await page.goto(`${BASE}/produit/${productSlug}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);

    const section = page.locator("#references-oe");
    check("the OE section is on the page", (await section.count()) === 1);

    const text = await section.innerText();
    check("grouped under the carmakers", /RENAULT/.test(text) && /PEUGEOT/.test(text) && /CITRO/.test(text));
    check("and the unattributed numbers are still printed", /sans constructeur indiqué/i.test(text));

    const links = section.locator("a");
    check("every number is a link", (await links.count()) === 5, `${await links.count()} link(s)`);

    const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    check(
      "linked on the normalised form, so one number is one address",
      hrefs.every((h) => /^\/reference\/[A-Z0-9]+$/.test(h)),
      hrefs.join(" "),
    );
    check(
      "spacing in the typed number does not become a second address",
      hrefs.includes(`/reference/7701234${STAMP.slice(0, 3)}`),
      hrefs.join(" "),
    );

    // The link has to land somewhere, which is the whole point of making it one.
    const target = hrefs.find((h) => h.endsWith(SHARED));
    const res = await page.goto(`${BASE}${target}`, { waitUntil: "domcontentloaded" });
    check("the reference page it points at exists", res.status() === 200, `${res.status()} ${target}`);
    const refPage = await page.locator("main").innerText();
    check("and it is this part", refPage.includes(STAMP));
    // The number belongs to two carmakers, and the page reached by typing it
    // says so — that is the first thing somebody holding the old part needs.
    check(
      "the reference page names the carmakers that stamp the number",
      /Numéro d'origine/.test(refPage) && /PEUGEOT/.test(refPage) && /CITRO/.test(refPage),
      refPage.split("\n").find((l) => l.includes("origine")) ?? "",
    );
  }

  /* ------------------------------------------------------------- [3] ----- */
  console.log("\n[3] WHO MADE THE PART, WHERE A BUYER CAN FIND IT");
  {
    await page.goto(`${BASE}/produit/${productSlug}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);

    const panel = page.locator("#fabricant");
    check("the manufacturer panel is on the page", (await panel.count()) === 1);

    const text = await panel.innerText();
    check("it names the company", text.includes("QA Fabrication GmbH"));
    check("gives a postal address", text.includes("Rixbecker Str. 75") && text.includes("59552 Lippstadt"));
    check("and the country", text.includes("Allemagne"));

    const tel = await panel.locator('a[href^="tel:"]').first().getAttribute("href");
    check("the phone is dialable — digits in the link, punctuation on screen", tel === "tel:+49294138" + "0", tel);
    check("the phone reads as the manufacturer writes it", text.includes("+49 2941 / 38 - 0"));

    const mail = await panel.locator('a[href^="mailto:"]').first().getAttribute("href");
    check("the e-mail is writable", mail === "mailto:qa@example.com", mail);

    const site = panel.locator('a[href^="http"]').first();
    check("the website link carries a scheme", (await site.getAttribute("href")) === "https://www.example.com/");
    check("and reads without one", (await site.innerText()).trim() === "example.com");
  }

  /* ------------------------------------------------------------- [4] ----- */
  console.log("\n[4] NOTHING IS INVENTED FOR A PART THAT HAS NOTHING");
  {
    // A part with no references and a brand with no manufacturer details:
    // both sections must be absent, not empty-but-present. An "Informations
    // fabricant" heading with nothing under it claims we looked.
    const bare = await prisma.product.findFirst({
      where: {
        active: true,
        oemRefs: { isEmpty: true },
        references: { none: {} },
        OR: [{ brandId: null }, { brand: { legalName: null, phone: null, email: null, website: null, street: null } }],
      },
      select: { slug: true, name: true },
    });

    if (!bare) {
      check("a part with no references exists to check (skipped: none in catalogue)", true);
    } else {
      await page.goto(`${BASE}/produit/${bare.slug}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);
      check("no OE section on a part with no OE numbers", (await page.locator("#references-oe").count()) === 0, bare.slug);
      check("no manufacturer panel on a brand with no details", (await page.locator("#fabricant").count()) === 0);
      const body = await page.locator("main").innerText();
      check("and no empty heading left standing", !/Informations fabricant/i.test(body));
    }
  }

  /* ------------------------------------------------------------- [5] ----- */
  console.log("\n[5] PETROL OR DIESEL, ASKED BEFORE THE MOTORISATION");
  {
    // A model the shop recorded with two fuels, and one recorded with a single
    // fuel — the step has to appear for the first and be skipped for the
    // second, because a step with one button is not a choice.
    const models = await prisma.vehicleModel.findMany({
      include: { make: true, engines: { select: { fuel: true, powerHp: true } } },
    });
    const fuelsOf = (m) => [...new Set(m.engines.map((e) => e.fuel?.trim()).filter(Boolean))];
    const multi = models.find((m) => fuelsOf(m).length > 1);
    const single = models.find((m) => fuelsOf(m).length === 1 && m.engines.length >= 1);
    check("the catalogue has a model with more than one fuel to test with", !!multi,
          multi && `${multi.make.name} ${multi.name}`);

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);

    // The finder's own button, named exactly — the header carries a "Mon
    // véhicule · Sélectionner" chip that matches a looser pattern first.
    const openPicker = async () => {
      await page.getByRole("button", { name: /^choisir ma voiture$/i }).first().click();
      await page.waitForTimeout(700);
      const dialog = page.locator('[role="dialog"]');
      await dialog.waitFor({ state: "visible", timeout: 10_000 });
      const know = dialog.getByRole("button", { name: /je connais ma voiture/i }).first();
      if (await know.count()) {
        await know.click();
        await page.waitForTimeout(500);
      }
      return dialog;
    };

    const dialog = await openPicker();
    await dialog.getByRole("button", { name: new RegExp(`^${multi.make.name}`, "i") }).first().click();
    await page.waitForTimeout(400);
    await dialog.getByRole("button", { name: new RegExp(`^${multi.name}`, "i") }).first().click();
    await page.waitForTimeout(400);

    const steps = await dialog.locator("ol li").allInnerTexts();
    check("the stepper grows a fourth step", steps.some((s) => /carburant/i.test(s)), steps.join(" › "));

    const body = await dialog.innerText();
    for (const f of fuelsOf(multi)) {
      check(`«${f}» is offered as a choice`, body.includes(f));
    }
    check(
      "and nothing else is — the list is the fuels this model was recorded with",
      !/hybride|électrique|gpl/i.test(body) || fuelsOf(multi).some((f) => /hybride|électrique|gpl/i.test(f)),
    );

    const diesel = fuelsOf(multi).find((f) => /diesel/i.test(f)) ?? fuelsOf(multi)[0];
    await dialog.getByRole("button", { name: new RegExp(`^${diesel}`, "i") }).first().click();
    await page.waitForTimeout(400);

    const engineText = await dialog.innerText();
    const expected = await prisma.vehicleEngine.findMany({
      where: { modelId: multi.id },
      select: { name: true, fuel: true, powerHp: true },
    });
    const shouldShow = expected.filter((e) => (e.fuel ?? "").trim() === diesel);
    const shouldHide = expected.filter((e) => (e.fuel ?? "").trim() !== diesel);
    check("choosing a fuel leaves only that fuel's motorisations",
          shouldShow.every((e) => engineText.includes(e.name)), shouldShow.map((e) => e.name).join(", "));
    check("and drops the others", shouldHide.every((e) => !engineText.includes(e.name)),
          shouldHide.map((e) => e.name).join(", ") || "none to drop");

    // Power in both units, the way the trade writes it. A conversion, not a
    // claim: 1 ch is exactly 0.73549875 kW.
    const withPower = shouldShow.find((e) => e.powerHp);
    if (withPower) {
      const kw = Math.round(withPower.powerHp * 0.73549875);
      check("each motorisation shows its power in kW and in ch",
            engineText.includes(`${kw} kW / ${withPower.powerHp} ch`), `${kw} kW / ${withPower.powerHp} ch`);
    } else {
      check("no power recorded, so none is printed", !/kW/.test(engineText));
    }

    // Back has to return to the question that was asked, not past it.
    await dialog.getByRole("button", { name: /retour|back/i }).first().click();
    await page.waitForTimeout(400);
    check("going back returns to the fuel question", (await dialog.innerText()).includes(diesel));

    // A motorisation the shop recorded without a fuel must not disappear when
    // a fuel is chosen: we do not know it is not a diesel, and telling a
    // shopper their car is not covered because one field was left blank is
    // the worst possible use of a missing value. Blanked here and restored,
    // because the catalogue has no such row today.
    {
      // Added rather than blanked: emptying an existing engine's fuel would
      // leave the model with one fuel and remove the very step under test.
      const orphan = await prisma.vehicleEngine.create({
        data: { modelId: multi.id, name: `QA sans carburant ${STAMP}`, fuel: null },
        select: { id: true, name: true },
      });
      try {
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(900);
        const d3 = await openPicker();
        await d3.getByRole("button", { name: new RegExp(`^${multi.make.name}`, "i") }).first().click();
        await page.waitForTimeout(400);
        await d3.getByRole("button", { name: new RegExp(`^${multi.name}`, "i") }).first().click();
        await page.waitForTimeout(400);
        await d3.getByRole("button", { name: new RegExp(`^${diesel}`, "i") }).first().click();
        await page.waitForTimeout(400);
        check(
          "a motorisation with no fuel recorded is not hidden by a fuel choice",
          (await d3.innerText()).includes(orphan.name),
          orphan.name,
        );
      } finally {
        await prisma.vehicleEngine.delete({ where: { id: orphan.id } }).catch(() => {});
      }
    }

    // And the step must not appear where there is nothing to ask.
    if (single) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(900);
      const d2 = await openPicker();
      await d2.getByRole("button", { name: new RegExp(`^${single.make.name}`, "i") }).first().click();
      await page.waitForTimeout(400);
      await d2.getByRole("button", { name: new RegExp(`^${single.name}`, "i") }).first().click();
      await page.waitForTimeout(400);
      const s2 = await d2.locator("ol li").allInnerTexts();
      check("a model with one fuel is not asked the question",
            !s2.some((s) => /carburant/i.test(s)), `${single.make.name} ${single.name}: ${s2.join(" › ")}`);
      check("it goes straight to the motorisations",
            (await d2.innerText()).includes(single.engines.length ? "" : "—") ||
              s2.some((s) => /motorisation/i.test(s)));
    }
  }

  /* ------------------------------------------------------------- [6] ----- */
  console.log("\n[6] THE COMPATIBILITY LIST IS SOMETHING YOU CAN SEARCH");
  {
    // The deepest fitment coverage in the catalogue, so the folding and the
    // filter have something real to work on.
    const rows = await prisma.$queryRaw`
      SELECT p.slug, COUNT(DISTINCT mk.id) AS makes
      FROM "Product" p
      JOIN "ProductFitment" f ON f."productId" = p.id
      JOIN "VehicleEngine" e ON e.id = f."engineId"
      JOIN "VehicleModel" md ON md.id = e."modelId"
      JOIN "VehicleMake" mk ON mk.id = md."makeId"
      WHERE p.active
      GROUP BY p.slug
      ORDER BY makes DESC
      LIMIT 1
    `;
    const slug = rows[0]?.slug;
    const makeCount = Number(rows[0]?.makes ?? 0);
    check("the catalogue has a well-covered part to test with", makeCount >= 2, `${makeCount} make(s)`);

    await page.goto(`${BASE}/produit/${slug}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);

    const summary = await page.locator("main").innerText();
    check("the makes are named at the top, not counted", /Compatible avec\s+\w/.test(summary));

    const section = page.locator("#vehicules");
    check("the list has an address to link to", (await section.count()) === 1);

    const shown = () => section.locator("li > p").count();
    const before = await shown();
    check("a long list is folded rather than printed whole", before <= 6, `${before} of ${makeCount} shown`);

    if (makeCount > 6) {
      await section.getByRole("button", { name: /voir les \d+ autre/i }).click();
      await page.waitForTimeout(300);
      check("and opens to all of it", (await shown()) === makeCount, `${await shown()} shown`);
    }

    const first = (await section.locator("li > p").first().innerText()).trim();
    await section.locator('select[aria-label="Filtrer par marque"]').selectOption(first);
    await page.waitForTimeout(300);
    check("filtering by make leaves only that make", (await shown()) === 1, first);

    await section.getByRole("button", { name: /réinitialiser/i }).click();
    await page.waitForTimeout(300);
    check("and resetting brings the rest back", (await shown()) > 1);

    const modelLink = section.locator('a[href^="/pieces/"]').first();
    const href = await modelLink.getAttribute("href");
    const res = await page.request.get(`${BASE}${href}`);
    check("every model is a way into that car's own page", res.status() === 200, `${res.status()} ${href}`);
  }

  /* ------------------------------------------------------------- [7] ----- */
  console.log("\n[7] THE PAGE SAYS WHAT «COMPATIBLE» IS ACTUALLY WORTH");
  {
    await page.goto(`${BASE}/produit/${productSlug}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const notice = page.locator("#compatibilite-explication");
    check("the question is asked on the page", (await notice.count()) === 1);
    check("folded, because it is an answer to a question", !(await notice.evaluate((el) => el.open)));

    await notice.locator("summary").click();
    await page.waitForTimeout(250);
    const text = await notice.innerText();
    check("it admits the list can be wider than one car", /finitions|séries|versions/i.test(text));
    check("it says who does the checking", /carte grise|châssis|VIN/i.test(text));
    check("it warns before the part is fitted, not after", /avant de la poser|déjà posée/i.test(text));
    // The catalogues this borrows its shape from sell a paid VIN check at
    // checkout. This shop has no such product, so the page must not offer one.
    check(
      "and it offers no service this shop does not have",
      !/option|payant|supplément|au moment de la commande, cochez/i.test(text),
    );
  }

  /* ------------------------------------------------------------- [8] ----- */
  console.log("\n[8] A SHOPPER WITH NO CAR IS ASKED HERE, NOT SENT ELSEWHERE");
  {
    const fresh = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const p = await fresh.newPage();
    await p.goto(`${BASE}/produit/${productSlug}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(700);

    const ask = p.getByRole("button", { name: /sélectionner mon véhicule/i });
    check("the product page asks for the car", (await ask.count()) === 1);
    const body = await p.locator("main").innerText();
    check("and no longer points at a control somewhere else", !/en haut de la page/i.test(body));

    await ask.click();
    await p.waitForTimeout(600);
    check("tapping it opens the picker without leaving the part",
          (await p.locator('[role="dialog"]').count()) === 1 && p.url().includes(productSlug));
    await fresh.close();
  }

  /* ------------------------------------------------------------- [9] ----- */
  console.log("\n[9] ALL OF IT FITS ON A PHONE");
  {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await phone.newPage();
    await p.goto(`${BASE}/produit/${productSlug}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(800);

    const width = await p.evaluate(() => document.documentElement.scrollWidth);
    check("the page does not scroll sideways at 390px", width <= 391, `${width}px`);

    // The OE chips are the new risk: a long unbroken part number in a flex row.
    await p.locator("#references-oe").scrollIntoViewIfNeeded();
    const overflow = await p.evaluate(() => {
      const section = document.querySelector("#references-oe");
      if (!section) return -1;
      return [...section.querySelectorAll("a")].filter(
        (a) => a.getBoundingClientRect().right > document.documentElement.clientWidth + 1,
      ).length;
    });
    check("no OE number runs off the screen edge", overflow === 0, `${overflow} over`);

    await p.locator("#compatibilite-explication summary").click();
    await p.waitForTimeout(300);
    const afterOpen = await p.evaluate(() => document.documentElement.scrollWidth);
    check("nor does the explanation once it is opened", afterOpen <= 391, `${afterOpen}px`);
    await phone.close();

    // Arabic is where a layout bug shows up, because the start edge moves.
    // Part numbers stay left-to-right inside a right-to-left page, and that
    // is exactly the combination that has broken this site before.
    const rtl = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await rtl.addCookies([{ name: "apa_locale", value: "ar", url: BASE }]);
    const ap = await rtl.newPage();
    await ap.goto(`${BASE}/produit/${productSlug}`, { waitUntil: "domcontentloaded" });
    await ap.waitForTimeout(800);
    const arMetrics = await ap.evaluate(() => ({
      dir: document.documentElement.dir,
      w: document.documentElement.scrollWidth,
      vw: window.innerWidth,
    }));
    check("the product page does not scroll sideways in Arabic either",
          arMetrics.dir === "rtl" && arMetrics.w <= arMetrics.vw + 1,
          `dir=${arMetrics.dir}, ${arMetrics.w}px on ${arMetrics.vw}px`);
    const ltrRun = await ap.evaluate(() => {
      const a = document.querySelector('#references-oe a');
      return a ? getComputedStyle(a).direction : null;
    });
    check("and a part number still reads left to right inside it", ltrRun === "ltr", String(ltrRun));
    await rtl.close();
  }
} catch (err) {
  // A thrown selector is a failure of the suite, not a silence: without this
  // the cleanup block ran and the run reported "0 passed, 0 failed", which
  // reads as a suite that had nothing to say.
  fail++;
  console.log(`  FAIL  the suite threw — ${err?.message ?? err}`);
  console.log(String(err?.stack ?? "").split("\n").slice(1, 4).join("\n"));
} finally {
  /* ------------------------------------------------------------ clean ---- */
  if (productSlug) {
    const p = await prisma.product.findUnique({ where: { sku: SKU }, select: { id: true } });
    if (p) {
      await prisma.partReference.deleteMany({ where: { productId: p.id } });
      await prisma.productSlugHistory.deleteMany({ where: { productId: p.id } });
      await prisma.product.delete({ where: { id: p.id } }).catch(() => {});
    }
  }
  if (brandId) await prisma.brand.delete({ where: { id: brandId } }).catch(() => {});

  await browser.close();
  await prisma.$disconnect();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
