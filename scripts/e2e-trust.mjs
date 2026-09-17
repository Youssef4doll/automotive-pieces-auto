/**
 * Trust: the shop never offers a channel it cannot answer, nor a promise it
 * cannot keep.
 *
 * An audit scored trust 4.5/10 and the reasons were all one shape. Every
 * WhatsApp button on the site opened a chat app with no number behind it. The
 * home page said "Passez nous voir" with no address under it, and the checkout
 * offered free collection from a shop nobody could find. "Conditions ·
 * Confidentialité" was two words of grey text rather than two links, and
 * "Livraison & retours" opened WhatsApp instead of a policy.
 *
 * The rule that came out of it: a missing setting removes the offer, it does
 * not ship a dead one. That is checked here from both sides — with the shop's
 * details empty, and with them filled in — because a fail-closed rule that
 * also fails when the data IS there is just a switched-off feature.
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const KEYS = ["shop_whatsapp", "shop_phone", "shop_address", "shop_email"];
const before = await prisma.setting.findMany({ where: { key: { in: KEYS } } });
const restore = async () => {
  for (const key of KEYS) {
    const row = before.find((r) => r.key === key);
    if (row) {
      await prisma.setting.upsert({ where: { key }, create: row, update: { value: row.value } });
    } else {
      await prisma.setting.deleteMany({ where: { key } });
    }
  }
};
process.on("uncaughtException", async (err) => {
  await restore();
  console.error(err);
  process.exit(1);
});

const set = async (patch) => {
  for (const [key, value] of Object.entries(patch)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

/** Every href on the page, after hydration. */
async function hrefs(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  return page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
}

const PAGES = ["/", "/contact", "/commande", "/panier", "/conditions", "/livraison-retours", "/confidentialite"];

try {
  /* ---------------------------------------------------------------- */
  console.log("\n[1] WITH NO NUMBER ENTERED, NOTHING OFFERS TO CHAT OR CALL");
  {
    await set({ shop_whatsapp: "", shop_phone: "", shop_address: "", shop_email: "" });
    const page = await (await browser.newContext()).newPage();
    const dead = [];
    for (const path of PAGES) {
      for (const href of await hrefs(page, path)) {
        if (/wa\.me|api\.whatsapp\.com/.test(href ?? "")) dead.push(`${path} → ${href}`);
        if (/^tel:/.test(href ?? "")) dead.push(`${path} → ${href}`);
      }
    }
    check("no WhatsApp or tel: link anywhere", dead.length === 0, dead.slice(0, 4).join(", ") || `${PAGES.length} pages`);
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log("\n[2] A HALF-ENTERED NUMBER IS TREATED AS NO NUMBER");
  {
    // `216` and `+216` are not blank, not the default and not a run of zeros,
    // so every earlier test passed them — and the shop shipped `wa.me/216`.
    const page = await (await browser.newContext()).newPage();
    for (const partial of ["216", "+216", "00000000"]) {
      await set({ shop_whatsapp: partial, shop_phone: partial });
      const bad = [];
      for (const href of await hrefs(page, "/")) {
        const digits = (href ?? "").replace(/\D/g, "");
        if (/wa\.me/.test(href ?? "") && digits.length < 8) bad.push(href);
        if (/^tel:/.test(href ?? "") && digits.length < 8) bad.push(href);
      }
      check(`"${partial}" produces no link`, bad.length === 0, bad.join(", "));
    }
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log("\n[3] WITH A REAL NUMBER, THE CHANNELS COME BACK");
  {
    await set({ shop_whatsapp: "21698765432", shop_phone: "+216 71 234 567" });
    const page = await (await browser.newContext()).newPage();
    const all = await hrefs(page, "/");
    const wa = all.filter((h) => /wa\.me/.test(h ?? ""));
    check("WhatsApp links are offered again", wa.length > 0, `${wa.length} link(s)`);
    check("and every one carries a full number",
      wa.every((h) => (h ?? "").replace(/\D/g, "").length >= 8), wa.slice(0, 2).join(", "));

    const profile = await hrefs(page, "/conditions");
    const tel = profile.filter((h) => /^tel:/.test(h ?? ""));
    check("the terms page offers a number to call", tel.length > 0, tel.join(", "));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log("\n[4] COLLECTION IS ONLY OFFERED WHERE THERE IS A COUNTER");
  {
    const page = await (await browser.newContext()).newPage();
    const visible = async (path) => {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(900);
      return (await page.locator("body").innerText()).replace(/\s+/g, " ");
    };

    await set({ shop_address: "" });
    let home = await visible("/");
    check("no address: the shop does not say 'Passez nous voir'", !/Passez nous voir/i.test(home));
    check("no address: the footer does not advertise collection",
      !/Retrait en magasin/i.test(await visible("/panier")));

    await set({ shop_address: "12 avenue de la République, Tunis" });
    home = await visible("/");
    check("with an address: the shop invites a visit again", /Passez nous voir/i.test(home));
    check("and prints the address it invites you to", /avenue de la République/i.test(home));
  }

  /* ---------------------------------------------------------------- */
  console.log("\n[5] THE POLICIES ARE PAGES, AND THEY ARE LINKED");
  {
    const page = await (await browser.newContext()).newPage();
    const footer = await hrefs(page, "/");
    for (const path of ["/conditions", "/confidentialite", "/livraison-retours"]) {
      check(`the footer links to ${path}`, footer.includes(path) || footer.some((h) => h?.startsWith(path)));
      const res = await fetch(`${BASE}${path}`);
      check(`${path} answers`, res.status === 200, `status ${res.status}`);
    }

    // The specific regression: this label used to open a chat app.
    const returnsLink = footer.find((h) => h?.startsWith("/livraison-retours"));
    check("'Livraison & retours' goes to the policy, not to WhatsApp", !!returnsLink, returnsLink ?? "not found");

    const terms = await visibleText(page, "/conditions");
    check("the terms say how you pay", /espèces à la livraison/i.test(terms));
    check("and admit what has not been published yet",
      /pas encore publié|ne sont pas encore renseignées/i.test(terms));

    const privacy = await visibleText(page, "/confidentialite");
    check("privacy states no card data is held", /aucune donnée bancaire/i.test(privacy));

    const returns = await visibleText(page, "/livraison-retours");
    check("returns states the 14-day window", /14 jours/i.test(returns));
    check("and the 12-month warranty", /12 mois/i.test(returns));
    await page.context().close();
  }
} finally {
  await restore();
  await browser.close();
}

async function visibleText(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

console.log(`\n${pass} passed, ${fail} failed`);
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
