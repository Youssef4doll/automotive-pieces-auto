// The website as a person who has never bought a car part sees it.
//
// Five customers, each one a sentence somebody would actually say, each one
// taken all the way to a part they could buy. What is asserted is not that a
// component rendered, but that the route out of "I need a part" and into "this
// one fits, add it" exists and is short.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

/** A shopper who has never been here before — no vehicle, no cart, no session. */
const freshPhone = async () => {
  const ctx = await browser.newContext(phone);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("  JS ERROR:", e.message));
  return p;
};

try {
  console.log("\n[1] THE HOMEPAGE ASKS ONE QUESTION");
  {
    const p = await freshPhone();
    await p.goto(BASE);
    await p.waitForTimeout(1500);

    const finder = p.locator("#finder");
    check("the page asks what the visitor is looking for", /Que cherchez-vous/i.test(await finder.innerText()));

    // The 2-second test: the routes must be reachable without hunting.
    const box = await finder.locator("button[aria-pressed]").first().boundingBox();
    const fold = 844 * 1.6; // one comfortable flick of the thumb
    check("the first route is within a flick of the top", box && box.y < fold, `y=${Math.round(box?.y ?? -1)}`);

    const routes = await finder.locator("button[aria-pressed]").allInnerTexts();
    check("four ways in, no more", routes.length === 4, routes.map((r) => r.split("\n")[0]).join(" · "));
    check("one of them is for not knowing the word",
          routes.some((r) => /ne sais pas comment/i.test(r)));
    check("exactly one is chosen to begin with",
          (await finder.locator('button[aria-pressed="true"]').count()) === 1);

    // A control that does nothing is worse than no control.
    const dead = await p.locator("main span").evaluateAll((els) =>
      els.filter((e) => /rounded-full/.test(e.className) && /^(Tous|Freinage|Filtres|Huile)$/.test(e.textContent.trim())).length,
    );
    check("no fake filter pills on the homepage", dead === 0, `${dead} found`);
    await p.close();
  }

  console.log("\n[2] « JE SAIS QUELLE PIÈCE » — TYPED BADLY, ON A PHONE");
  {
    const p = await freshPhone();
    await p.goto(BASE);
    await p.waitForTimeout(1500);
    await p.locator("#finder").getByRole("button", { name: /Je sais quelle pièce/ }).click();
    await p.waitForTimeout(400);

    const input = p.locator('#finder input[type="search"]');
    check("the search box is the thing in front of them", await input.isVisible());

    // Misspelt, unaccented, and singular where the catalogue is plural.
    await input.fill("plaquete de frin");
    await p.locator("#finder").getByRole("button", { name: /Rechercher/i }).click();
    await p.waitForURL(/\/recherche/, { timeout: 15000 });
    await p.waitForTimeout(1800);

    const body = await p.locator("main").innerText();
    const results = await p.locator('main a[href^="/produit/"]').count();
    check("a badly typed query still reaches parts", results > 0, `${results} results`);
    check("and the shop says how it read the query", /compris comme|Vous cherchiez peut-être/i.test(body));
    await p.close();
  }

  console.log("\n[3] « JE CONNAIS MA VOITURE » — AND EVERY PART THEN SAYS IF IT FITS");
  {
    const p = await freshPhone();
    await p.goto(BASE);
    await p.waitForTimeout(1500);

    const finder = p.locator("#finder");
    check("the car route is the one open by default",
          /Je connais ma voiture/.test(await finder.locator('button[aria-pressed="true"]').innerText()));

    await finder.getByRole("button", { name: /Choisir ma voiture/ }).click();
    await p.waitForTimeout(1200);

    // Make → model → engine, with nothing typed.
    const make = await prisma.vehicleMake.findFirst({
      where: { models: { some: { engines: { some: {} } } } },
      select: { name: true, models: { where: { engines: { some: {} } }, take: 1, select: { name: true, engines: { take: 1, select: { name: true } } } } },
    });
    const model = make.models[0];
    const engine = model.engines[0];

    await p.getByRole("button", { name: make.name, exact: true }).first().click();
    await p.waitForTimeout(500);
    await p.getByRole("button", { name: new RegExp(model.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
    await p.waitForTimeout(500);
    await p.getByRole("button", { name: new RegExp(engine.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
    await p.waitForTimeout(1500);

    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("apa-vehicle") || "{}")?.state?.vehicle);
    check("three taps and the car is known", saved?.engineName === engine.name, `${saved?.makeName} ${saved?.modelName} ${saved?.engineName}`);

    // And it is not asked again anywhere.
    await p.goto(BASE);
    await p.waitForTimeout(1500);
    check("the homepage now shows the car back to them",
          (await p.locator("#finder").innerText()).includes(make.name));

    const cat = await prisma.category.findFirst({
      where: { parentId: null, OR: [{ products: { some: { active: true } } }, { children: { some: { products: { some: { active: true } } } } }] },
      select: { slug: true, name: true },
    });
    await p.goto(`${BASE}/catalogue/${cat.slug}`);
    await p.waitForTimeout(1800);
    const catBody = await p.locator("main").innerText();
    check("a category page states the car rather than re-asking", catBody.includes(make.name), cat.name);
    check("and says compatible parts come first", /compatibles.*affich|affich.*compatibles/i.test(catBody));
    check("it does not ask for the car twice", !/Dites-nous votre voiture/.test(catBody));
    await p.close();
  }

  console.log("\n[4] A CATEGORY PAGE WITH NO CAR ASKS FOR IT ONCE, IN PLACE");
  {
    const p = await freshPhone();
    const cat = await prisma.category.findFirst({ where: { parentId: null }, select: { slug: true } });
    await p.goto(`${BASE}/catalogue/${cat.slug}`);
    await p.waitForTimeout(1600);

    const body = await p.locator("main").innerText();
    check("the car is asked for", /Dites-nous votre voiture/.test(body));
    check("with the reason given", /ce qui va sur votre voiture/i.test(body));
    check("and only once", (body.match(/Dites-nous votre voiture/g) ?? []).length === 1);
    check("the old second prompt is gone", !/Indiquez votre voiture pour ne voir/.test(body));

    // Asking must not mean leaving the page.
    await p.getByRole("button", { name: /Choisir ma voiture/ }).click();
    await p.waitForTimeout(1200);
    check("the picker opens over the category, not on another page",
          p.url().includes(`/catalogue/${cat.slug}`), p.url().replace(BASE, ""));
    await p.close();
  }

  console.log("\n[5] « JE NE SAIS PAS COMMENT ÇA S'APPELLE »");
  {
    const p = await freshPhone();
    await p.goto(BASE);
    await p.waitForTimeout(1500);
    await p.locator("#finder").getByRole("button", { name: /ne sais pas comment/ }).click();
    await p.waitForTimeout(400);

    const panel = p.locator("#finder");
    const text = await panel.innerText();
    check("the shop takes the problem off them", /C'est normal|on l'identifie/i.test(text));
    check("a photo is offered", /Envoyer une photo/.test(text));
    check("a person is offered", /Parler à un expert/.test(text));
    check("and browsing is offered", /Parcourir les familles/.test(text));

    const expert = panel.locator('a[href*="wa.me"], a[href*="#magasin"]').first();
    check("the expert route is a real link", (await expert.count()) > 0, await expert.getAttribute("href"));
    await p.close();
  }

  console.log("\n[6] « J'AI LA RÉFÉRENCE »");
  {
    const p = await freshPhone();
    const sample = await prisma.product.findFirst({ where: { active: true }, select: { sku: true, slug: true } });
    await p.goto(BASE);
    await p.waitForTimeout(1500);
    await p.locator("#finder").getByRole("button", { name: /J'ai la référence/ }).click();
    await p.waitForTimeout(400);

    // Written the way it comes off a greasy box: lower case, with a space.
    const messy = sample.sku.toLowerCase().replace("-", " ");
    await p.locator("#finder input[dir=ltr]").fill(messy);
    await p.locator("#finder").getByRole("button", { name: /Chercher la référence/ }).click();
    await p.waitForURL(/\/(produit|recherche)/, { timeout: 15000 });
    await p.waitForTimeout(1200);
    check(`« ${messy} » reaches the part`, p.url().includes(sample.slug) || (await p.locator('main a[href^="/produit/"]').count()) > 0,
          p.url().replace(BASE, ""));
    await p.close();
  }

  console.log("\n[7] FROM THE HOMEPAGE TO A PART IN THE BASKET");
  {
    const p = await freshPhone();
    await p.goto(BASE);
    await p.waitForTimeout(1500);
    await p.locator("#finder").getByRole("button", { name: /Je sais quelle pièce/ }).click();
    await p.waitForTimeout(400);
    await p.locator('#finder input[type="search"]').fill("filtre");
    await p.locator("#finder").getByRole("button", { name: /Rechercher/i }).click();
    await p.waitForURL(/\/recherche/, { timeout: 15000 });
    await p.waitForTimeout(1800);

    await p.locator('main a[href^="/produit/"]').first().click();
    await p.waitForTimeout(1800);

    const product = await p.locator("main").innerText();
    check("the product page answers the price", /\d+[.,]\d{2}\s*DT/.test(product));
    check("and whether it is available", /En stock|Rupture/i.test(product));
    check("and offers the one action", (await p.getByRole("button", { name: /Ajouter au panier/ }).count()) > 0);

    await p.getByRole("button", { name: /Ajouter au panier/ }).first().click();
    await p.waitForTimeout(1200);
    const qty = await p.evaluate(() => JSON.parse(localStorage.getItem("apa-cart") || "{}")?.state?.items?.length ?? 0);
    check("adding does not throw the shopper off the page", p.url().includes("/produit/"));
    check("and the part really is in the basket", qty > 0, `${qty} line(s)`);
    await p.close();
  }

  console.log("\n[8] THE BOARD OF FAMILIES SAYS WHAT IS BEHIND EACH TILE");
  {
    const p = await freshPhone();
    await p.goto(BASE);
    await p.waitForTimeout(1500);
    await p.locator("#symptomes").scrollIntoViewIfNeeded();
    await p.waitForTimeout(900);

    const board = p.locator("#symptomes");
    const tiles = board.locator('button[aria-controls^="subs-"]');
    const n = await tiles.count();
    check("every family is a tile", n > 5, `${n} families`);

    // The count is parts, not our filing structure, and it matches the
    // catalogue rather than being decorative.
    const first = await tiles.first().innerText();
    check("each tile states how many parts are behind it", /\d+\s+pièces?/.test(first), first.replace(/\n/g, " · "));

    const singulars = (await board.innerText()).match(/\b1 pièces\b/g) ?? [];
    check("and counts one part as one pièce", singulars.length === 0, singulars.join(", "));

    const dbTotal = await prisma.product.count({
      where: { active: true, category: { OR: [{ slug: "filtres" }, { parent: { slug: "filtres" } }] } },
    });
    const shown = (await board.innerText()).match(/FILTRES\s+(\d+)\s+pièces?/i);
    if (shown) check("the number is the real one", Number(shown[1]) === dbTotal, `page ${shown[1]} vs db ${dbTotal}`);

    // No family shows a bare letter placeholder any more.
    const drawn = await tiles.first().locator("svg, img").count();
    check("a tile without a photo is drawn, not lettered", drawn > 0, `${drawn} graphics`);
    await p.close();
  }

  console.log("\n[9] A REFERENCE TYPED INTO THE HERO GOES TO THE PART");
  {
    const p = await freshPhone();
    const sample = await prisma.product.findFirst({ where: { active: true }, select: { sku: true, slug: true } });
    await p.goto(BASE);
    await p.waitForTimeout(1500);

    const scope = p.locator("section select").first();
    check("the search box asks what kind of search this is", (await scope.count()) === 1);
    await scope.selectOption("ref");
    await p.waitForTimeout(300);

    await p.locator('section input[type="search"]').first().fill(sample.sku);
    await p.locator("section").first().getByRole("button", { name: /Rechercher/i }).click();
    await p.waitForURL(/\/(produit|recherche)/, { timeout: 15000 });
    await p.waitForTimeout(1200);
    check("a known reference lands straight on its part", p.url().includes(`/produit/${sample.slug}`),
          p.url().replace(BASE, ""));

    // An unknown one must not dead-end.
    await p.goto(BASE);
    await p.waitForTimeout(1500);
    await p.locator("section select").first().selectOption("ref");
    await p.locator('section input[type="search"]').first().fill("ZZ-INCONNU-999");
    await p.locator("section").first().getByRole("button", { name: /Rechercher/i }).click();
    await p.waitForURL(/\/recherche/, { timeout: 15000 });
    await p.waitForTimeout(1500);
    check("an unknown one falls through to the search, not a dead end",
          /pas trouvé de correspondance|résultat/i.test(await p.locator("main").innerText()));
    await p.close();
    await prisma.searchMiss.deleteMany({ where: { query: { contains: "ZZ-INCONNU" } } });
  }

  console.log("\n[10] A MAKE PAGE READS LIKE A LIST OF CARS");
  {
    const p = await freshPhone();
    const mk = await prisma.vehicleMake.findFirst({
      where: { models: { some: { engines: { some: { fitments: { some: {} } } } } } },
      select: { slug: true, name: true },
    });
    await p.goto(`${BASE}/pieces/${mk.slug}`);
    await p.waitForTimeout(1500);
    const body = await p.locator("main").innerText();

    check("models are listed, not boxed into chips", (await p.locator("main ul li a").count()) > 0);
    const withYears = await prisma.vehicleModel.count({ where: { make: { slug: mk.slug }, yearFrom: { not: null } } });
    if (withYears > 0) check("with the years the car was sold", /\d{4}\s*–\s*(\d{4}|auj\.)/.test(body), body.slice(0, 120).replace(/\n/g, " · "));
    check("and each row names the make with the model", body.includes(mk.name));
    await p.close();
  }
} finally {
  await browser.close();
  await prisma.$disconnect();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
