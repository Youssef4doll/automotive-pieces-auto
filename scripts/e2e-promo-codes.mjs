// Promo codes end to end, on the LOCAL shop: the admin creates one, the
// website checkout applies it (the discount is the server's figure), an order
// placed with it records it, and switching the code off stops it.
//
//   node scripts/e2e-promo-codes.mjs
//
// Cleans up after itself: the code, and the test order it places.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { waitForAdmin } from "./lib/wait-for-admin.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error("e2e-promo-codes: local shop only");
  process.exit(1);
}
const prisma = new PrismaClient();
const CODE = `QA${Date.now().toString(36).toUpperCase().slice(-6)}`;

let failures = 0;
const check = (cond, what, detail) => {
  if (!cond) failures++;
  console.log(`${cond ? "ok  " : "FAIL"}  ${what}${detail !== undefined ? " " + JSON.stringify(detail) : ""}`);
};
const quote = async (items, promoCode) =>
  (await (await fetch(`${BASE}/api/v1/cart/quote`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items, promoCode }) })).json()).data;

const part = await prisma.product.findFirst({
  where: { active: true, stockQty: { gt: 2 }, priceSell: { gte: 60, lte: 120 } },
  select: { id: true, name: true, sku: true, slug: true, priceSell: true, stockQty: true },
});
const items = [{ productId: part.id, qty: 1 }];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
p.on("pageerror", (e) => console.log("  PAGE ERROR:", e.message));
let orderRef = null;

try {
  await p.goto(`${BASE}/compte`);
  await p.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
  await p.fill('input[name="password"]', "admin1234");
  await p.getByRole("button", { name: "Se connecter", exact: true }).click();
  await waitForAdmin(p, BASE);

  // ---- the admin: a bad code is refused, a good one is created
  await p.goto(`${BASE}/admin/codes-promo`);
  await p.fill('input[name="code"]', CODE);
  await p.fill('input[name="value"]', "95");
  await p.getByRole("button", { name: "Créer le code" }).click();
  await p.waitForTimeout(1200);
  check(await p.getByText("ne dépasse pas 90 %").isVisible(), "admin: a 95 % code is refused");
  await p.fill('input[name="code"]', CODE);
  await p.fill('input[name="value"]', "10");
  await p.getByRole("button", { name: "Créer le code" }).click();
  await p.waitForTimeout(1500);
  check(await p.getByText(`Code ${CODE} créé.`).isVisible(), "admin: code created");
  check(await p.locator("li", { hasText: CODE }).getByText("Actif").isVisible(), "admin: listed as active");

  // ---- the server prices it
  const q = await quote(items, CODE.toLowerCase());
  const expected = Math.round(Number(part.priceSell) * 10) / 100;
  check(q.promo?.code === CODE && Math.abs(q.discount - expected) < 0.011, "quote: 10 % off the parts, typed in lower case", { discount: q.discount, expected });

  // ---- the website checkout applies it and the order records it
  await p.goto(`${BASE}/`);
  await p.evaluate(
    (it) => localStorage.setItem("apa-cart", JSON.stringify({ state: { items: [it] }, version: 0 })),
    { productId: part.id, name: part.name, sku: part.sku, slug: part.slug, imageUrl: "/images/placeholder.jpg", unitPrice: Number(part.priceSell), qty: 1, stockQty: part.stockQty },
  );
  await p.goto(`${BASE}/commande`);
  await p.waitForTimeout(1500);
  await p.fill("#promo", "nope-nope");
  await p.getByRole("button", { name: "Appliquer" }).click();
  await p.waitForTimeout(1200);
  check(await p.getByText("Ce code n'existe pas.").isVisible(), "checkout: an unknown code is refused");
  await p.fill("#promo", CODE);
  await p.getByRole("button", { name: "Appliquer" }).click();
  await p.waitForTimeout(1500);
  check((await p.getByText(`Code ${CODE}`).count()) >= 1, "checkout: the code applies");

  await p.fill('input[name="name"]', "Sami Ben Ali").catch(() => {});
  await p.fill('input[name="phone"]', "22334455").catch(() => {});
  await p.fill('textarea[name="address"], input[name="address"]', "12 rue de Marseille, Tunis").catch(() => {});
  await p.locator('form button[type="submit"]').last().click();
  await p.waitForURL(/confirmation/, { timeout: 20000 }).catch(() => {});
  orderRef = decodeURIComponent(p.url().split("/").pop() ?? "");
  const order = orderRef.startsWith("CMD-") ? await prisma.order.findUnique({ where: { ref: orderRef }, select: { promoCode: true, discount: true, subtotal: true, total: true, shippingFee: true } }) : null;
  check(order?.promoCode === CODE && Math.abs(Number(order.discount) - expected) < 0.011, "order: code and discount recorded", order && { ...order, discount: Number(order.discount) });
  check(order && Math.abs(Number(order.total) - (Number(order.subtotal) - Number(order.discount) + Number(order.shippingFee))) < 0.011, "order: total = parts − discount + delivery");
  check(await p.getByText(`Code ${CODE}`).isVisible().catch(() => false), "confirmation: the discount line names the code");

  // ---- switched off, it stops
  await p.goto(`${BASE}/admin/codes-promo`);
  await p.locator("li", { hasText: CODE }).getByRole("button", { name: "Désactiver" }).click();
  await p.waitForTimeout(1200);
  const off = await quote(items, CODE);
  check(off.promo === null && off.promoError?.reason === "inactive", "quote: a switched-off code is refused", off.promoError);
  check(await p.locator("li", { hasText: CODE }).getByText("1 utilisation").isVisible(), "admin: the use is counted from the order");
} catch (e) {
  check(false, "e2e-promo-codes threw", String(e));
} finally {
  // The test order goes, and the unit it took goes back on the shelf.
  if (orderRef?.startsWith("CMD-")) {
    const gone = await prisma.order.deleteMany({ where: { ref: orderRef } });
    if (gone.count) {
      await prisma.product.update({ where: { id: part.id }, data: { stockQty: { increment: 1 } } });
      await prisma.stockMovement.deleteMany({ where: { productId: part.id, note: `Commande ${orderRef}` } });
    }
  }
  await prisma.promoCode.deleteMany({ where: { code: CODE } });
  await browser.close();
  await prisma.$disconnect();
}
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
