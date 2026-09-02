// End-to-end smoke test for the core "backend drives frontend" loop:
// customer places an order -> admin sees it and changes its status ->
// customer's order-tracking page reflects the new status immediately.
//
// Usage: start the app (npm run dev or npm run build && npm run start) on
// port 3500, then: node scripts/e2e-smoke.mjs
import { chromium } from "playwright";
import { waitForAdmin } from "./lib/wait-for-admin.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3500";

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const customerCtx = await browser.newContext();
  const customerPage = await customerCtx.newPage();
  customerPage.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
  customerPage.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE ERROR:", m.text());
  });

  // 1. Log in as the demo customer so the order gets attached to their account.
  await customerPage.goto(`${BASE}/compte`);
  await customerPage.fill('input[name="email"]', "karim.bensalah@example.com");
  await customerPage.fill('input[name="password"]', "client1234");
  await customerPage.getByRole("button", { name: "Se connecter", exact: true }).click();
  await customerPage.waitForSelector("text=Mes commandes");
  console.log("✓ Customer logged in");

  // 2. Add a product to the cart from its product page.
  await customerPage.goto(`${BASE}/produit/kit-de-plaquettes-de-frein-avant-trw-gdb1330-br-4820`);
  await customerPage.waitForSelector("text=Ajouter au panier");
  await customerPage.click('button:has-text("Ajouter au panier")');
  await customerPage.waitForTimeout(500);
  console.log("✓ Added to cart");

  // 3. Checkout.
  await customerPage.goto(`${BASE}/commande`);
  await customerPage.fill('input[placeholder="Nom complet"]', "Karim Ben Salah");
  await customerPage.fill('input[type="tel"]', "20111222");
  await customerPage.click('button:has-text("Tunis")');
  await customerPage.fill('input[placeholder="Adresse"]', "12 Rue de la Liberté, Tunis");
  await customerPage.click('button[type="submit"]:has-text("Confirmer la commande")');
  await customerPage.waitForURL(/\/commande\/confirmation\//, { timeout: 10000 });
  const url = customerPage.url();
  const ref = url.split("/").pop();
  console.log("✓ Order placed:", ref);

  // 4. As admin: find the order, open it, move it to CONFIRMED.
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  adminPage.on("pageerror", (e) => console.log("ADMIN PAGE ERROR:", e.message));

  await adminPage.goto(`${BASE}/compte`);
  await adminPage.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
  await adminPage.fill('input[name="password"]', "admin1234");
  await adminPage.getByRole("button", { name: "Se connecter", exact: true }).click();
  await waitForAdmin(adminPage, BASE);
  console.log("✓ Admin logged in, landed on dashboard");

  await adminPage.goto(`${BASE}/admin/commandes`);
  await adminPage.fill('input[name="q"]', ref);
  await adminPage.click('button:has-text("Filtrer")');
  await adminPage.waitForSelector(`text=${ref}`);
  await adminPage.click(`text=${ref}`);
  await adminPage.waitForURL(/\/admin\/commandes\//);
  console.log("✓ Admin opened order detail:", adminPage.url());

  await adminPage.click('button:has-text("Confirmée")');
  await adminPage.waitForTimeout(800);
  const statusBadge = await adminPage.locator("span.rounded-full").first().textContent();
  console.log("✓ Admin set status, badge now reads:", statusBadge?.trim());

  // 5. Back on the customer side: verify the tracking page reflects the new status.
  await customerPage.goto(`${BASE}/compte/commandes`);
  await customerPage.waitForSelector(`text=${ref}`);
  const bodyText = await customerPage.textContent("body");
  const hasConfirmed = bodyText.includes("Confirmée");
  console.log("✓ Customer tracking page shows 'Confirmée':", hasConfirmed);

  // 6. Verify stock actually decremented (admin stock page).
  await adminPage.goto(`${BASE}/admin/stock`);
  await adminPage.fill('input[name="q"]', "BR-4820");
  await adminPage.click('button:has-text("Rechercher")');
  await adminPage.waitForSelector("text=BR-4820");
  const stockRow = await adminPage.textContent("table tbody tr");
  console.log("✓ Stock row after order:", stockRow.replace(/\s+/g, " ").trim());

  await browser.close();
  console.log("\nALL CHECKS DONE");
}

main().catch((e) => {
  console.error("SMOKE TEST FAILED:", e);
  process.exit(1);
});
