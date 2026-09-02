// The customer edits their own account and signs out — the two things the
// account area could not do before. Uses a throwaway account created here and
// deleted at the end, so nothing in the shop's real customer table is touched.
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

const EMAIL = `qa-profil-${Date.now()}@example.test`;
const NEW_EMAIL = `qa-profil-${Date.now()}-b@example.test`;
const PASSWORD = "motdepasse1";
const NEXT_PASSWORD = "motdepasse2";

const user = await prisma.user.create({
  data: {
    email: EMAIL,
    name: "Qa Profil",
    phone: "20000000",
    passwordHash: await bcrypt.hash(PASSWORD, 12),
    role: "CUSTOMER",
  },
});

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("  PAGE ERROR:", e.message));

const signIn = async (email, password) => {
  await p.goto(`${BASE}/compte`);
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', password);
  await p.getByRole("button", { name: "Se connecter", exact: true }).click();
  await p.waitForURL(`${BASE}/compte`, { timeout: 20000 });
  // waitForURL resolves the moment the address changes, which is before the
  // action's own redirect has finished replaying. Navigating away in that gap
  // gets undone by the redirect and lands back on /compte.
  await p.waitForTimeout(1500);
};

try {
  console.log("\n[1] THE PROFILE IS EDITABLE IN PLACE");
  {
    await signIn(EMAIL, PASSWORD);
    await p.goto(`${BASE}/compte/profil`);
    await p.waitForTimeout(700);

    const card = p.locator('section[aria-labelledby="infos"]');
    check("the card starts in read mode", (await card.locator('input[name="name"]').count()) === 0);

    await card.getByRole("button", { name: "Modifier" }).click();
    await p.waitForTimeout(300);
    check("Modifier reveals the fields", (await card.locator('input[name="name"]').count()) === 1);
    check("prefilled with what is stored", (await card.locator('input[name="name"]').inputValue()) === "Qa Profil");

    await card.locator('input[name="name"]').fill("Qa Profil Modifié");
    await card.locator('input[name="phone"]').fill("21555444");
    await card.locator('input[name="email"]').fill(NEW_EMAIL);
    await card.getByRole("button", { name: "Enregistrer" }).click();
    await p.waitForTimeout(1800);

    const row = await prisma.user.findUnique({ where: { id: user.id } });
    check("the name is saved", row.name === "Qa Profil Modifié", row.name);
    check("the phone is saved", row.phone === "21555444", row.phone);
    check("the email is saved", row.email === NEW_EMAIL, row.email);
    check("the card returns to read mode", (await card.locator('input[name="name"]').count()) === 0);
    check("and the page shows the new value", (await card.innerText()).includes("Qa Profil Modifié"));
  }

  console.log("\n[2] AN EMAIL ALREADY IN USE IS REFUSED, NOT CRASHED");
  {
    const other = await prisma.user.findFirst({ where: { id: { not: user.id } }, select: { email: true } });
    const card = p.locator('section[aria-labelledby="infos"]');
    await card.getByRole("button", { name: "Modifier" }).click();
    await p.waitForTimeout(300);
    await card.locator('input[name="email"]').fill(other.email);
    await card.getByRole("button", { name: "Enregistrer" }).click();
    await p.waitForTimeout(1500);

    check("the customer is told why", (await card.innerText()).includes("existe déjà"));
    check("they stay in the form with their typing", (await card.locator('input[name="email"]').inputValue()) === other.email);
    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } });
    check("and nothing was written", row.email === NEW_EMAIL, row.email);

    await card.getByRole("button", { name: "Annuler" }).click();
    await p.waitForTimeout(300);
  }

  console.log("\n[3] THE PASSWORD CHANGE NEEDS THE CURRENT ONE");
  {
    const card = p.locator('section[aria-labelledby="motdepasse"]');
    await card.getByRole("button", { name: "Modifier" }).click();
    await p.waitForTimeout(300);

    await card.locator('input[name="current"]').fill("pas-le-bon");
    await card.locator('input[name="next"]').fill(NEXT_PASSWORD);
    await card.locator('input[name="confirm"]').fill(NEXT_PASSWORD);
    await card.getByRole("button", { name: "Changer le mot de passe" }).click();
    await p.waitForTimeout(1500);
    check("a wrong current password is refused", (await card.innerText()).includes("actuel incorrect"));

    await card.locator('input[name="current"]').fill(PASSWORD);
    await card.locator('input[name="next"]').fill(NEXT_PASSWORD);
    await card.locator('input[name="confirm"]').fill("autre-chose");
    await card.getByRole("button", { name: "Changer le mot de passe" }).click();
    await p.waitForTimeout(1500);
    check("a mistyped confirmation is caught", (await card.innerText()).includes("ne correspondent pas"));

    await card.locator('input[name="confirm"]').fill(NEXT_PASSWORD);
    await card.getByRole("button", { name: "Changer le mot de passe" }).click();
    await p.waitForTimeout(1800);

    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    check("the new password is what is stored now", await bcrypt.compare(NEXT_PASSWORD, row.passwordHash));
    check("the old one no longer works", !(await bcrypt.compare(PASSWORD, row.passwordHash)));
  }

  console.log("\n[4] SIGNING OUT IS ONE TAP FROM ANY ACCOUNT PAGE");
  {
    await p.goto(`${BASE}/compte/commandes`);
    await p.waitForTimeout(700);
    check("the rail carries a logout control", (await p.getByRole("button", { name: "Se déconnecter" }).count()) >= 1);

    await p.getByRole("button", { name: "Mon compte" }).click();
    await p.waitForTimeout(300);
    const menu = p.locator("#account-menu");
    check("the avatar opens a menu", await menu.isVisible());
    check("naming who is signed in", (await menu.innerText()).includes(NEW_EMAIL));

    await menu.getByRole("button", { name: "Se déconnecter" }).click();
    await p.waitForURL(`${BASE}/`, { timeout: 20000 });
    check("logging out lands on the storefront", p.url() === `${BASE}/`);

    // The account pages redirect from inside the render, which Next delivers
    // as part of the stream rather than as a 307 — so the address only settles
    // once the payload has been applied, not when `goto` returns.
    await p.goto(`${BASE}/compte/commandes`);
    await p.waitForURL(`${BASE}/compte`, { timeout: 15000 }).catch(() => {});
    check("a signed-out visitor is bounced to the login", p.url() === `${BASE}/compte`, p.url());
    check("and is asked to sign in again", (await p.locator('input[name="password"]').count()) === 1);
    check("with nothing of the account left on screen", !(await p.locator("body").innerText()).includes(NEW_EMAIL));
  }

  console.log("\n[5] THE NEW PASSWORD SIGNS THEM BACK IN");
  {
    await signIn(NEW_EMAIL, NEXT_PASSWORD);
    check("back inside the account area", p.url().startsWith(`${BASE}/compte`), p.url());
  }
} finally {
  console.log("\n[6] CLEAN UP");
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  check("the throwaway account is removed", (await prisma.user.count({ where: { id: user.id } })) === 0);
  await browser.close();
  await prisma.$disconnect();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
