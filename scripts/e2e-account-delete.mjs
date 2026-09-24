// "Supprimer mon compte" on the website — the web route the stores are given
// for deleting an account, and the same deletion as the app's. A throwaway
// account with one order is created here; the account is deleted through
// the page, and the order is checked to still exist, detached.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const EMAIL = `qa-delete-${Date.now()}@example.test`;
const PASSWORD = "motdepasse1";
const user = await prisma.user.create({
  data: { email: EMAIL, name: "Qa Suppression", phone: "20000001", passwordHash: await bcrypt.hash(PASSWORD, 12), role: "CUSTOMER" },
});
const last = await prisma.order.findFirst({ orderBy: { ref: "desc" }, select: { ref: true } });
const order = await prisma.order.create({
  data: {
    ref: `CMD-QA${Date.now() % 100000}`,
    userId: user.id,
    customerName: "Qa Suppression",
    phone: "20000001",
    governorate: "Tunis",
    subtotal: 10,
    total: 10,
  },
});
void last;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
p.on("pageerror", (e) => console.log("  PAGE ERROR:", e.message));

try {
  await p.goto(`${BASE}/compte`);
  await p.fill('input[name="email"]', EMAIL);
  await p.fill('input[name="password"]', PASSWORD);
  await p.getByRole("button", { name: "Se connecter", exact: true }).click();
  await p.waitForURL(`${BASE}/compte`, { timeout: 20000 });
  await p.waitForTimeout(1500);

  await p.goto(`${BASE}/compte/profil`);
  const card = p.locator('section[aria-labelledby="suppression"]');
  check("the profile offers deletion", (await card.count()) === 1);
  await card.getByRole("button", { name: "Supprimer", exact: true }).click();
  const text = await card.innerText();
  check("it says what goes and what stays", /Sont supprimés/.test(text) && /commandes passées restent/.test(text));

  await card.locator('input[name="password"]').fill("pas-le-bon");
  await card.getByRole("button", { name: "Supprimer définitivement" }).click();
  await p.waitForTimeout(2500);
  check("a wrong password is refused", /Mot de passe incorrect/.test(await card.innerText()));
  check("and the account is still there", Boolean(await prisma.user.findUnique({ where: { id: user.id } })));

  await card.locator('input[name="password"]').fill(PASSWORD);
  await card.getByRole("button", { name: "Supprimer définitivement" }).click();
  await p.waitForURL(/\/compte\?supprime=1/, { timeout: 20000 });
  await p.waitForTimeout(800);
  check("the customer lands on a confirmation", /Votre compte a été supprimé/.test(await p.innerText("body")));
  check("signed out", (await p.locator('input[name="password"]').count()) > 0);
  check("the account row is gone", !(await prisma.user.findUnique({ where: { id: user.id } })));
  const kept = await prisma.order.findUnique({ where: { id: order.id }, select: { userId: true } });
  check("the order is kept, detached", kept !== null && kept.userId === null, JSON.stringify(kept));
} catch (e) {
  check("the suite threw", false, e.message.split("\n")[0]);
} finally {
  await prisma.order.deleteMany({ where: { id: order.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  await browser.close();
  await prisma.$disconnect();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
