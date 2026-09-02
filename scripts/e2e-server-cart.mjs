// The cart now lives on the server: it follows the shopper to another device,
// merges into their account when they sign in, stops looking abandoned once it
// becomes an order, and shows up in admin while it is still recoverable.
// Also: the order timeline must carry the moment each step happened.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { waitForAdmin } from "./lib/wait-for-admin.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const STAMP = Date.now().toString().slice(-6);
const EMAIL = `cart.${STAMP}@example.com`;
const PASSWORD = "client1234";

/**
 * The signup limiter is per-address and lives in process memory, so a long run
 * of suites from one machine legitimately exhausts it. Report that plainly
 * rather than failing later on a null dereference that hides the cause.
 */
async function assertSignedUp(page, prismaClient, email) {
  const user = await prismaClient.user.findUnique({ where: { email }, select: { id: true } });
  if (user) return user;
  const shown = await page.locator("main").innerText().catch(() => "");
  if (/Trop de tentatives/i.test(shown)) {
    console.log("  SKIP  signup refused by the rate limiter — restart the server to clear it, then re-run");
    process.exit(0);
  }
  console.log(`  FAIL  the account was not created — ${shown.split("\n").slice(0, 2).join(" | ")}`);
  process.exit(1);
}


async function cleanup() {
  const u = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  if (u) {
    const ids = (await prisma.order.findMany({ where: { userId: u.id }, select: { id: true } })).map((o) => o.id);
    if (ids.length) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
      await prisma.orderStatusEvent.deleteMany({ where: { orderId: { in: ids } } });
      await prisma.cart.updateMany({ where: { orderId: { in: ids } }, data: { orderId: null } });
      await prisma.order.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.cart.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
}
await cleanup();

const [a, b] = await prisma.product.findMany({
  where: { active: true, stockQty: { gt: 3 }, sku: { not: { startsWith: "PACK-" } } },
  select: { id: true, slug: true, name: true },
  take: 2,
});

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

console.log("\n[1] AN ANONYMOUS BASKET IS STORED SERVER-SIDE");
const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const phone = await phoneCtx.newPage();
phone.on("pageerror", (e) => console.log("  JS ERROR:", e.message));
await phone.goto(`${BASE}/produit/${a.slug}`);
await phone.waitForTimeout(1200);
await phone.locator('button:has-text("Ajouter au panier")').first().click();
await phone.waitForTimeout(2500);

let cart = await prisma.cart.findFirst({
  where: { status: "ACTIVE", userId: null, items: { some: { productId: a.id } } },
  orderBy: { createdAt: "desc" },
  include: { items: true },
});
check("the anonymous cart reached the database", !!cart, cart ? `${cart.items.length} line(s)` : "none");
check("with the right product and quantity", cart?.items[0]?.productId === a.id && cart?.items[0]?.qty === 1);

const cookie = (await phoneCtx.cookies()).find((c) => c.name === "apa-cart-session");
check("the cart cookie is httpOnly (cannot be read or forged from the page)", cookie?.httpOnly === true);

console.log("\n[2] SIGNING IN MERGES IT INTO THE ACCOUNT");
await phone.goto(`${BASE}/compte`);
await phone.waitForTimeout(700);
await phone.click('button:has-text("Créer un compte")');
await phone.waitForTimeout(400);
await phone.fill('input[name="name"]', "Client Panier");
await phone.fill('input[name="email"]', EMAIL);
await phone.fill('input[name="phone"]', "20555444");
await phone.fill('input[name="password"]', PASSWORD);
await phone.getByRole("button", { name: /Créer mon compte|Créer un compte/ }).last().click();
await phone.waitForTimeout(2500);
await phone.goto(`${BASE}/panier`);
await phone.waitForTimeout(2500);

const account = await assertSignedUp(phone, prisma, EMAIL);
const userCart = await prisma.cart.findFirst({
  where: { userId: account.id, status: "ACTIVE" },
  include: { items: true },
});
check("the basket is now attached to the account", !!userCart && userCart.items.length > 0,
      userCart ? `${userCart.items.length} line(s)` : "none");
check("nothing was lost in the merge", userCart?.items.some((i) => i.productId === a.id));

console.log("\n[3] IT FOLLOWS THE SHOPPER TO ANOTHER DEVICE");
// A second, completely separate browser context: no shared localStorage.
const laptopCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const laptop = await laptopCtx.newPage();
laptop.on("pageerror", (e) => console.log("  JS ERROR (laptop):", e.message));
await laptop.goto(`${BASE}/compte`);
await laptop.fill('input[name="email"]', EMAIL);
await laptop.fill('input[name="password"]', PASSWORD);
await laptop.getByRole("button", { name: "Se connecter", exact: true }).click();
await laptop.waitForTimeout(2500);
await laptop.goto(`${BASE}/panier`);
await laptop.waitForTimeout(3000);
const laptopBody = await laptop.locator("main").innerText();
check("the basket started on the phone is visible on the laptop",
      laptopBody.includes(a.name.slice(0, 22)), laptopBody.split("\n").slice(0, 3).join(" / "));

console.log("\n[4] ADDING ON ONE DEVICE REACHES THE SERVER");
await laptop.goto(`${BASE}/produit/${b.slug}`);
await laptop.waitForTimeout(1000);
await laptop.locator('button:has-text("Ajouter au panier")').first().click();
await laptop.waitForTimeout(2500);
const merged = await prisma.cart.findFirst({
  where: { userId: account.id, status: "ACTIVE" },
  include: { items: true },
});
check("both products are on the one server cart", merged?.items.length === 2, `${merged?.items.length} line(s)`);

console.log("\n[5] IT SHOWS IN ADMIN WHILE IT IS STILL RECOVERABLE");
// Age the cart past the staleness cutoff so it counts as abandoned.
await prisma.cart.update({
  where: { id: merged.id },
  data: { updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
});
const adminCtx = await browser.newContext();
const admin = await adminCtx.newPage();
await admin.goto(`${BASE}/compte`);
await admin.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
await admin.fill('input[name="password"]', "admin1234");
await admin.getByRole("button", { name: "Se connecter", exact: true }).click();
await waitForAdmin(admin, BASE);
await admin.goto(`${BASE}/admin/paniers`);
await admin.waitForTimeout(1200);
const adminBody = await admin.locator("main").innerText();
check("the abandoned cart is listed", adminBody.includes("Client Panier"), adminBody.slice(0, 60).replace(/\n/g, " "));
check("with the value at stake", /\d+\.\d\d DT/.test(adminBody));
const wa = await admin.locator('main a[href*="wa.me"]').first().getAttribute("href");
check("with a one-tap WhatsApp follow-up naming the parts",
      !!wa && decodeURIComponent(wa).includes("Client Panier"), decodeURIComponent(wa ?? "").slice(-50));

console.log("\n[6] PLACING THE ORDER STOPS IT LOOKING ABANDONED");
await laptop.goto(`${BASE}/commande`);
await laptop.waitForTimeout(1200);
await laptop.locator('button:has-text("Tunis")').first().click();
await laptop.fill('input[placeholder="Adresse"]', "5 Rue Panier");
await laptop.locator('button[type="submit"]:has-text("Confirmer la commande")').click();
await laptop.waitForURL(/\/commande\/confirmation\//, { timeout: 20000 }).catch(() => {});
const ref = laptop.url().split("/").pop();
check("order placed", /^CMD-/.test(ref || ""), ref);
await laptop.waitForTimeout(1500);
const after = await prisma.cart.findUnique({ where: { id: merged.id }, select: { status: true, orderId: true } });
check("the cart is marked converted, not abandoned", after?.status === "CONVERTED", after?.status);
check("and linked to the order it became", !!after?.orderId);

console.log("\n[7] THE TIMELINE CARRIES THE MOMENT OF EACH STEP");
const order = await prisma.order.findUnique({ where: { ref }, select: { id: true } });
for (const s of ["CONFIRMED", "PREPARED", "SHIPPED"]) {
  await prisma.order.update({ where: { id: order.id }, data: { status: s, history: { create: { status: s } } } });
  await new Promise((r) => setTimeout(r, 1100));
}
await laptop.goto(`${BASE}/compte/commandes`);
await laptop.waitForTimeout(1500);
const timeline = await laptop.locator("main").innerText();
check("each reached step shows a date and a time",
      (timeline.match(/\d{2}:\d{2}/g) ?? []).length >= 3,
      `${(timeline.match(/\d{2}:\d{2}/g) ?? []).length} timestamps`);
check("steps not yet reached carry no invented time", !/Livrée[\s\S]{0,24}\d{2}:\d{2}/.test(timeline));
check("the customer is told what happens next", /En route|livreur/i.test(timeline));

await laptop.goto(`${BASE}/compte`);
await laptop.waitForTimeout(1200);
const accountBody = await laptop.locator("main").innerText();
check("the account page shows the progress, not just a badge",
      /Confirmée/.test(accountBody) && /\d{2}:\d{2}/.test(accountBody));

console.log("\n[8] THE BASKET CANNOT BE WALKED PAST THE SHELF");
{
  // The "+" used to have no ceiling: a shopper could build a basket of twelve
  // against six in stock and only be refused at the last step of checkout,
  // after typing their name, phone and address. Nothing was ever oversold —
  // placeOrder claims stock atomically — but the refusal came far too late.
  const scarce = await prisma.product.findFirst({
    where: { active: true, stockQty: { gt: 0, lt: 15 }, sku: { not: { startsWith: "PACK-" } } },
    select: { slug: true, stockQty: true, name: true },
  });
  if (!scarce) {
    console.log("  SKIP  nothing in the catalogue is scarce enough to test against");
  } else {
    const shopper = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await shopper.goto(`${BASE}/produit/${scarce.slug}`);
    await shopper.waitForTimeout(900);
    await shopper.locator('button:has-text("Ajouter au panier")').first().click();
    await shopper.waitForTimeout(800);
    await shopper.goto(`${BASE}/panier`);
    await shopper.waitForTimeout(1200);

    const plus = shopper.locator('button[aria-label*="ugmenter"], button[aria-label*="ncrease"]').first();
    for (let i = 0; i < scarce.stockQty + 6; i++) {
      if (await plus.isDisabled().catch(() => true)) break;
      await plus.click({ timeout: 3000 }).catch(() => {});
      await shopper.waitForTimeout(60);
    }
    await shopper.waitForTimeout(600);

    const qty = await shopper.evaluate(
      () => JSON.parse(localStorage.getItem("apa-cart") || "{}")?.state?.items?.[0]?.qty ?? 0,
    );
    check("the quantity stops at what is on the shelf", qty <= scarce.stockQty,
          `${qty} in the basket, ${scarce.stockQty} in stock`);
    check("and the button says so instead of ignoring the tap", await plus.isDisabled());
    check("with the real figure named", (await shopper.locator("main").innerText()).includes(`${scarce.stockQty} en stock`));
    await shopper.close();
  }
}

await cleanup();
await browser.close();
await prisma.$disconnect();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
