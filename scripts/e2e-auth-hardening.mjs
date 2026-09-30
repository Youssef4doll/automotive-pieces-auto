// Sign-in hardening and API protection, end to end, on the LOCAL shop:
//
//   passwords   — eight characters, not a common one, not the account's own
//                 name or e-mail; each refusal names its reason for the app;
//   e-mails     — stored lower-case; "Sami@…" signs in as "sami@…";
//   devices     — each phone's session carries its name; the account lists
//                 them, marks "this phone", signs out one or all the others;
//   password    — changed from the app with the current one; every other
//                 phone, staff session and website cookie is signed out,
//                 this phone is not;
//   resets      — three e-mails an hour per account, whoever asks;
//   orders      — the same Idempotency-Key twice (or twice at once) is one
//                 order, answered twice;
//   the wall    — an oversized body is refused (413) before any route reads it;
//   sorting     — every sort pages through a family without a repeat.
//
//   node scripts/e2e-auth-hardening.mjs
//
// Cleans up after itself: the accounts and the orders it made, and the stock.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error("e2e-auth-hardening: local shop only");
  process.exit(1);
}
const prisma = new PrismaClient();

let failures = 0;
const check = (cond, what, detail) => {
  if (!cond) failures++;
  console.log(`${cond ? "ok  " : "FAIL"}  ${what}${detail !== undefined ? " " + JSON.stringify(detail) : ""}`);
};
// Each run speaks from its own address, so the flood and signup windows of
// earlier runs never decide this one.
const IP = `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const api = async (path, { method = "GET", body, token, headers = {} } = {}) => {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: {
      "x-forwarded-for": IP,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
};

const stamp = Date.now().toString(36);
const EMAIL = `Sami.Hardening.${stamp}@Example.TN`;
const lower = EMAIL.toLowerCase();
const PASSWORD = "Piston-bleu-42";
const NEXT = "Soupape-verte-7";
const madeOrders = [];

try {
  console.log("\n[1] PASSWORDS");
  const signup = (password, extra = {}) =>
    api("/auth/signup", { method: "POST", body: { name: "Sami Hardening", email: EMAIL, phone: "20123987", password, ...extra } });
  for (const [password, reason] of [["k7#pLm2", "short"], ["azerty123", "common"], ["tunisie2024", "common"], ["12345678", "common"], ["Hardening!", "personal"]]) {
    const r = await signup(password);
    check(r.status === 422 && r.body?.field === "password" && r.body?.reason === reason, `refused "${password}" as ${reason}`, r.body);
  }

  console.log("\n[2] E-MAILS AND DEVICES");
  const made = await signup(PASSWORD, { device: "iPhone · iOS 18\u0000<script>" });
  check(made.status === 200 && made.body?.data?.token, "a strong password makes the account", made.status);
  const row = await prisma.user.findFirst({ where: { email: lower }, select: { id: true, email: true } });
  check(row?.email === lower, "the e-mail is stored lower-case", row?.email);
  const phoneA = made.body.data.token;
  const again = await signup(PASSWORD);
  check(again.status === 422 && again.body?.reason === "taken", "the same address in another case is taken");

  const signIn = (email, password, device) => api("/auth/session", { method: "POST", body: { email, password, device } });
  const b = await signIn(lower.toUpperCase(), PASSWORD, "Galaxy A54 · Android 14");
  check(b.status === 200, "signs in whatever the letter case", b.status);
  const phoneB = b.body?.data?.token;
  const c = await signIn(lower, PASSWORD, "Redmi · Android 13");
  const phoneC = c.body?.data?.token;

  let list = await api("/account/sessions", { token: phoneA });
  const sessions = list.body?.data?.sessions ?? [];
  check(sessions.length === 3, "three phones are listed", sessions.length);
  check(sessions.filter((s) => s.current).length === 1 && sessions.find((s) => s.current)?.device === "iPhone · iOS 18 <script>", "this phone is marked, its name kept on one line", sessions.find((s) => s.current)?.device);
  check(sessions.some((s) => s.device === "Galaxy A54 · Android 14"), "each phone carries its own name");

  const other = sessions.find((s) => s.device?.startsWith("Galaxy"));
  const stranger = await prisma.customerSession.findFirst({ where: { userId: { not: row.id } }, select: { id: true } });
  if (stranger) {
    const nope = await api(`/account/sessions/${stranger.id}`, { method: "DELETE", token: phoneA });
    check(nope.status === 404, "another account's session cannot be signed out", nope.status);
  }
  const one = await api(`/account/sessions/${other.id}`, { method: "DELETE", token: phoneA });
  check(one.status === 200 && one.body?.data?.revoked === 1, "signs out one other phone", one.body);
  check((await api("/account", { token: phoneB })).status === 401, "that phone is signed out");
  check((await api("/account", { token: phoneC })).status === 200, "the third is not");
  const self = await api(`/account/sessions/${sessions.find((s) => s.current).id}`, { method: "DELETE", token: phoneA });
  check(self.status === 404, "this phone is not signed out from the list (that is « Se déconnecter »)");

  console.log("\n[3] CHANGE PASSWORD");
  // A website cookie, signed in before the change.
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const web = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": IP } })).newPage();
  await web.goto(`${BASE}/compte`);
  await web.fill('input[name="email"]', lower);
  await web.fill('input[name="password"]', PASSWORD);
  await web.getByRole("button", { name: "Se connecter", exact: true }).click();
  await web.waitForTimeout(2500);
  await web.goto(`${BASE}/compte/profil`);
  check(/Sami/.test(await web.locator("main").innerText()), "signed in on the website");
  const staffLike = await prisma.adminSession.create({ data: { userId: row.id, tokenHash: `e2e-${stamp}`, expiresAt: new Date(Date.now() + 86400000) } });

  const change = (current, next, token = phoneA) => api("/account/password", { method: "POST", token, body: { current, next } });
  let r = await change("wrong-one-9", NEXT);
  check(r.status === 422 && r.body?.field === "current" && r.body?.reason === "wrong", "the current password is checked", r.body);
  r = await change(PASSWORD, PASSWORD);
  check(r.status === 422 && r.body?.field === "next" && r.body?.reason === "same", "the new one must differ", r.body);
  r = await change(PASSWORD, "motdepasse");
  check(r.status === 422 && r.body?.reason === "common", "the new one meets the rule", r.body);
  r = await change(PASSWORD, NEXT);
  check(r.status === 200 && r.body?.data?.signedOut === 1, "changed; one other phone signed out", r.body);
  check((await api("/account", { token: phoneA })).status === 200, "this phone stays signed in");
  check((await api("/account", { token: phoneC })).status === 401, "the other phone is signed out");
  check(!(await prisma.adminSession.findUnique({ where: { id: staffLike.id } })), "staff sessions are ended");
  await web.goto(`${BASE}/compte/profil`);
  await web.waitForTimeout(800);
  check(!/Sami Hardening/.test(await web.locator("body").innerText()), "the website cookie from before the change no longer opens the account");
  await browser.close();
  check((await signIn(lower, PASSWORD)).status === 401, "the old password no longer signs in");
  check((await signIn(lower, NEXT)).status === 200, "the new one does");

  console.log("\n[4] RESET E-MAILS PER ACCOUNT");
  const tokensBefore = await prisma.passwordResetToken.count({ where: { userId: row.id } });
  const ids = [];
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${BASE}/api/v1/auth/password-reset`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.66.${i}.${Math.floor(Math.random() * 250)}` },
      body: JSON.stringify({ email: EMAIL }),
    });
    const t = await prisma.passwordResetToken.findFirst({ where: { userId: row.id, usedAt: null }, select: { id: true } });
    ids.push({ status: res.status, id: t?.id });
  }
  check(ids.every((x) => x.status === 200), "every request answers the same", ids.map((x) => x.status));
  check(new Set(ids.map((x) => x.id)).size === 3 && ids[3].id === ids[2].id && ids[4].id === ids[2].id, "only three links an hour reach one inbox", tokensBefore);

  console.log("\n[5] ORDERS ARE SAFE TO RETRY");
  const part = await prisma.product.findFirst({ where: { active: true, stockQty: { gt: 6 } }, select: { id: true, stockQty: true } });
  const order = { customerName: "Sami Hardening", phone: "20123987", governorate: "Sfax", address: "12 rue de Marseille, Sfax", deliveryMethod: "DELIVERY", paymentMethod: "COD", items: [{ productId: part.id, qty: 1 }] };
  const key = `e2e${stamp}${"k".repeat(20)}`.slice(0, 40);
  const first = await api("/orders", { method: "POST", body: order, headers: { "idempotency-key": key } });
  const second = await api("/orders", { method: "POST", body: order, headers: { "idempotency-key": key } });
  madeOrders.push(first.body?.data?.ref);
  check(first.status === 200 && second.status === 200 && first.body.data.ref === second.body.data.ref, "the same key twice is the same order", [first.body?.data?.ref, second.body?.data?.ref]);
  check(second.body?.data?.replayed === true && second.body.data.token !== first.body.data.token, "the retry gets its own token");
  check((await api(`/orders/${second.body.data.ref}`, { token: second.body.data.token })).status === 200, "and it opens the order");
  const key2 = `e2e${stamp}${"z".repeat(20)}`.slice(0, 40);
  const [x, y] = await Promise.all([0, 1].map(() => api("/orders", { method: "POST", body: order, headers: { "idempotency-key": key2 } })));
  madeOrders.push(x.body?.data?.ref, y.body?.data?.ref);
  check(x.status === 200 && y.status === 200 && x.body.data.ref === y.body.data.ref, "two taps at once are one order", [x.body?.data?.ref, y.body?.data?.ref, x.body?.error, y.body?.error]);
  const bad = await api("/orders", { method: "POST", body: order, headers: { "idempotency-key": "short" } });
  check(bad.status === 422 && bad.body?.field === "idempotencyKey", "a malformed key is refused", bad.body);
  const stock = await prisma.product.findUnique({ where: { id: part.id }, select: { stockQty: true } });
  check(stock.stockQty === part.stockQty - 2, "stock moved for two orders, not four", [part.stockQty, stock.stockQty]);

  console.log("\n[6] THE WALL");
  const huge = await fetch(`${BASE}/api/v1/auth/session`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": IP }, body: JSON.stringify({ email: "x".repeat(300_000) }) });
  check(huge.status === 413 && huge.headers.get("access-control-allow-origin") === "*", "an oversized body is refused before any route reads it", huge.status);

  console.log("\n[7] SORTING");
  const family = (await api("/catalogue/families")).body.data.sort((a, b) => b.productCount - a.productCount)[0];
  for (const sort of ["relevance", "price_asc", "price_desc", "newest", "popular"]) {
    const seen = [];
    for (let page = 1, more = true; more; page++) {
      const d = (await api(`/catalogue/products?family=${family.slug}&sort=${sort}&page=${page}`)).body.data;
      seen.push(...d.products);
      more = d.hasMore;
    }
    const prices = seen.map((p) => p.price);
    const ordered =
      sort === "price_asc" ? prices.every((p, i) => i === 0 || prices[i - 1] <= p) : sort === "price_desc" ? prices.every((p, i) => i === 0 || prices[i - 1] >= p) : true;
    check(new Set(seen.map((p) => p.id)).size === family.productCount && ordered, `${sort}: every part once${sort.startsWith("price") ? ", in price order" : ""}`, seen.length);
  }
} catch (e) {
  check(false, "threw", String(e).split("\n")[0]);
} finally {
  const user = await prisma.user.findFirst({ where: { email: lower }, select: { id: true } });
  const orders = await prisma.order.findMany({ where: { ref: { in: madeOrders.filter(Boolean) } }, select: { id: true, items: { select: { productId: true, qty: true } } } });
  for (const o of orders) {
    for (const it of o.items) if (it.productId) await prisma.product.update({ where: { id: it.productId }, data: { stockQty: { increment: it.qty } } });
    await prisma.order.delete({ where: { id: o.id } });
  }
  if (user) await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}

console.log(`\n${failures ? `${failures} failed` : "all passed"}`);
process.exit(failures ? 1 : 0);
