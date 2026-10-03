// Reaching the shop and signing in by phone, at the API, on the LOCAL shop:
//
//   sms codes   — a badly formed number is refused; a code goes out (the
//                 development outbox, lib/sms); three a quarter-hour per
//                 number, then "sent" and nothing sent; five wrong answers
//                 kill a code; only an HMAC is stored;
//   phone login — a new number gets a one-use ticket that opens an account
//                 with no e-mail and no password; signing in again finds it;
//                 a number merely TYPED on an e-mail account is not matched;
//                 a number linked from a signed-in account is; one number,
//                 one account; deleting a password-less account takes a code;
//   staff       — an admin's password sign-in carries the staff session; a
//                 customer's does not;
//   questions   — something to answer is required; the asker's token alone
//                 reads the answer; an order is attached only with its own
//                 token; the shop answers in writing (app questions only) and
//                 the answer shows on the order; the inbox is staff-only;
//   push        — a signed-in phone registers its token on its session.
//
//   node scripts/e2e-reach.mjs
//
// Cleans up after itself: accounts, codes, questions, the order and its stock.
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error("e2e-reach: local shop only");
  process.exit(1);
}
const prisma = new PrismaClient();
const OUTBOX = path.join(process.cwd(), ".sms-outbox.jsonl");

let failures = 0;
let passes = 0;
const check = (cond, what, detail) => {
  if (!cond) failures++;
  else passes++;
  console.log(`${cond ? "ok  " : "FAIL"}  ${what}${detail !== undefined ? " " + JSON.stringify(detail) : ""}`);
};
// Each run speaks from its own address, so earlier runs' windows never decide this one.
const IP = `10.78.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const api = async (p, { method = "GET", body, token, form } = {}) => {
  const res = await fetch(`${BASE}/api/v1${p}`, {
    method,
    headers: {
      "x-forwarded-for": IP,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const outbox = () => (fs.existsSync(OUTBOX) ? fs.readFileSync(OUTBOX, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const codeFor = (digits) => outbox().filter((m) => m.to === `+216${digits}`).at(-1)?.body.match(/^\d{6}/)?.[0] ?? null;
const sentTo = (digits) => outbox().filter((m) => m.to === `+216${digits}`).length;
// Eight digits starting 9, unique to this run.
const seed = Date.now() % 1_000_000;
const num = (i) => `9${String((seed * 7 + i * 7919) % 10_000_000).padStart(7, "0")}`;
const numbers = [1, 2, 3, 4, 5].map(num);
const stamp = Date.now().toString(36);
const EMAIL = `reach.${stamp}@example.tn`;
const EMAIL2 = `reach2.${stamp}@example.tn`;
const PASSWORD = "Piston-bleu-42";
const madeQuestions = [];
let orderRef = null;

try {
  console.log("\n[1] SMS CODES");
  const settings = await api("/settings/public");
  check(settings.body?.data?.auth?.phoneCode === true, "settings: the app is told codes can be sent", settings.body?.data?.auth);
  check((await api("/auth/phone/code", { method: "POST", body: { phone: "1234" } })).body?.field === "phone", "a badly formed number is refused");

  const [A, B, C, D, E] = numbers;
  check((await api("/auth/phone/code", { method: "POST", body: { phone: `+216 ${A}`, locale: "fr" } })).status === 200, "a code is sent");
  const codeA = codeFor(A);
  check(/^\d{6}$/.test(codeA ?? ""), "sms: six digits, first on the lock screen", codeA);
  const stored = await prisma.phoneCode.findFirst({ where: { phone: `+216${A}` }, orderBy: { createdAt: "desc" } });
  check(stored && stored.codeHash !== codeA && stored.codeHash.length === 64, "only an HMAC of the code is stored");

  // Wrong four times, then the fifth: that code is dead even when right afterwards.
  for (let i = 0; i < 4; i++) await api("/auth/phone/verify", { method: "POST", body: { phone: A, code: codeA === "000000" ? "111111" : "000000" } });
  const fifth = await api("/auth/phone/verify", { method: "POST", body: { phone: A, code: codeA === "000000" ? "111111" : "000000" } });
  check(fifth.body?.reason === "too_many", "five wrong answers kill the code", fifth.body);
  const late = await api("/auth/phone/verify", { method: "POST", body: { phone: A, code: codeA } });
  check(late.body?.reason === "too_many", "…and the right one no longer opens anything", late.body);

  // Sending budget: three a quarter-hour per number, then quietly nothing.
  await api("/auth/phone/code", { method: "POST", body: { phone: A } });
  await api("/auth/phone/code", { method: "POST", body: { phone: A } });
  const beforeFourth = sentTo(A);
  const fourth = await api("/auth/phone/code", { method: "POST", body: { phone: A } });
  check(fourth.status === 200 && sentTo(A) === beforeFourth, "a fourth code in fifteen minutes answers “sent” and sends nothing", { status: fourth.status, sent: sentTo(A) });

  console.log("\n[2] PHONE SIGN-IN");
  await api("/auth/phone/code", { method: "POST", body: { phone: B } });
  const v = await api("/auth/phone/verify", { method: "POST", body: { phone: B, code: codeFor(B), device: "Reach test" } });
  check(Boolean(v.body?.data?.ticket) && v.body.data.needsAccount === true, "a new number gets a ticket to open an account", v.body?.data);
  const opened = await api("/auth/phone/signup", { method: "POST", body: { ticket: v.body?.data?.ticket, name: "Sami Reach" } });
  const acct = opened.body?.data?.account;
  check(acct?.verifiedPhone === `+216${B}` && acct.email === null && acct.hasPassword === false && acct.staff === false, "the account: proved number, no e-mail, no password", acct);
  const again = await api("/auth/phone/signup", { method: "POST", body: { ticket: v.body?.data?.ticket, name: "Sami Reach" } });
  check(again.body?.field === "ticket", "a ticket opens one account only", again.body);
  await api("/auth/phone/code", { method: "POST", body: { phone: B } });
  const back = await api("/auth/phone/verify", { method: "POST", body: { phone: B, code: codeFor(B) } });
  check(back.body?.data?.account?.name === "Sami Reach" && Boolean(back.body.data.token), "signing in again finds the account", back.body?.data?.account);
  const phoneToken = back.body?.data?.token;

  // A number typed on an e-mail account proves nothing.
  const su = await api("/auth/signup", { method: "POST", body: { name: "Rania Typed", email: EMAIL, phone: C, password: PASSWORD } });
  check(su.status === 200 && su.body?.data?.account?.verifiedPhone === null, "an e-mail account with a typed number: not proved", su.body?.data?.account);
  await api("/auth/phone/code", { method: "POST", body: { phone: C } });
  const typed = await api("/auth/phone/verify", { method: "POST", body: { phone: C, code: codeFor(C) } });
  check(typed.body?.data?.needsAccount === true, "a code to that number does NOT sign in to the e-mail account", typed.body?.data);

  // Linked from the signed-in account, it does.
  const emailToken = su.body?.data?.token;
  check((await api("/account/phone/code", { method: "POST", token: emailToken, body: { phone: D } })).status === 200, "signed in: a code to add a number");
  const linked = await api("/account/phone", { method: "POST", token: emailToken, body: { phone: D, code: codeFor(D) } });
  check(linked.body?.data?.account?.verifiedPhone === `+216${D}`, "the number is linked", linked.body?.data?.account);
  await api("/auth/phone/code", { method: "POST", body: { phone: D } });
  const viaD = await api("/auth/phone/verify", { method: "POST", body: { phone: D, code: codeFor(D) } });
  check(viaD.body?.data?.account?.email === EMAIL, "…and now signs in to that account", viaD.body?.data?.account);

  // One number, one account.
  const su2 = await api("/auth/signup", { method: "POST", body: { name: "Other Account", email: EMAIL2, phone: E, password: PASSWORD } });
  const taken = await api("/account/phone/code", { method: "POST", token: su2.body?.data?.token, body: { phone: B } });
  check(taken.body?.reason === "taken", "a number another account proved is refused before any text", taken.body);

  // The password door refuses an account that has none, the same way as a wrong password.
  const pw = await api("/auth/session", { method: "POST", body: { email: EMAIL, password: "not-it-at-all" } });
  check(pw.status === 401, "a wrong password is still a plain 401");

  console.log("\n[3] STAFF");
  const admin = await api("/auth/session", { method: "POST", body: { email: "admin@automotive-pieces-auto.tn", password: "admin1234", device: "Reach test" } });
  const staffToken = admin.body?.data?.staff?.token;
  check(admin.body?.data?.account?.staff === true && Boolean(staffToken), "an admin's password sign-in carries the staff session");
  check((await api("/admin/dashboard", { token: staffToken })).status === 200, "…which opens the staff API");
  check(!su.body?.data?.staff && su.body?.data?.account?.staff === false, "a customer's does not");
  const dash = (await api("/admin/dashboard", { token: staffToken })).body?.data;
  check(Array.isArray(dash?.missing) && typeof dash?.messagesWaiting === "number", "dashboard: what is missing, and messages waiting", { missing: dash?.missing, waiting: dash?.messagesWaiting });

  console.log("\n[4] QUESTIONS");
  const form = (fields) => {
    const f = new FormData();
    for (const [k, val] of Object.entries(fields)) f.append(k, val);
    return f;
  };
  check((await api("/questions", { method: "POST", form: form({ name: "Karim Reach", phone: "22 333 444" }) })).body?.field === "body", "a question needs words or a photo");
  const q1 = await api("/questions", { method: "POST", form: form({ name: "Karim Reach", phone: "22 333 444", body: "Ce filtre va-t-il sur une Clio IV ?", productSku: "X-1" }) });
  const { id: qid, token: qtoken } = q1.body?.data ?? {};
  if (qid) madeQuestions.push(qid);
  check(Boolean(qid && qtoken), "asked: an id and the asker's token");
  check((await api(`/questions/${qid}`)).status === 404, "the id alone reads nothing");
  check((await api(`/questions/${qid}`, { token: "A".repeat(43) })).status === 404, "a forged token reads nothing");
  check((await api(`/questions/${qid}`, { token: qtoken })).body?.data?.reply === null, "the asker reads it: no answer yet");

  // An order: attached only with its own token.
  const products = (await (await fetch(`${BASE}/api/v1/catalogue/products?family=filtres`)).json()).data.products;
  const part = products.find((p) => p.availability === "IN_STOCK") ?? products[0];
  const placed = await api("/orders", {
    method: "POST",
    body: { customerName: "Reach Test", phone: "20 555 777", governorate: "Tunis", address: "1 rue du Test", deliveryMethod: "DELIVERY", paymentMethod: "COD", items: [{ productId: part.id, qty: 1 }] },
  });
  orderRef = placed.body?.data?.ref;
  const orderToken = placed.body?.data?.token;
  const wrongProof = await api("/questions", { method: "POST", form: form({ name: "Reach Test", phone: "20 555 777", body: "Et ma commande ?", orderRef, orderToken: "B".repeat(43) }) });
  if (wrongProof.body?.data?.id) madeQuestions.push(wrongProof.body.data.id);
  check(wrongProof.body?.data?.order === null, "a reference with a wrong token is context only, not the order");
  const q2 = await api("/questions", { method: "POST", form: form({ name: "Reach Test", phone: "20 555 777", body: "Livrable samedi ?", orderRef, orderToken }) });
  if (q2.body?.data?.id) madeQuestions.push(q2.body.data.id);
  check(q2.body?.data?.order === orderRef, "with the order's own token: tied to the order");

  // The shop answers; the answer shows to the asker and on the order.
  check((await api("/admin/messages")).status === 401, "the inbox is staff-only");
  const inbox = (await api("/admin/messages", { token: staffToken })).body?.data;
  check(inbox?.messages?.some((m) => m.id === q2.body?.data?.id && m.inApp), "the inbox lists it, from the app");
  const answered = await api(`/admin/messages/${q2.body?.data?.id}`, { method: "POST", token: staffToken, body: { reply: "Oui, samedi matin." } });
  check(answered.body?.data?.status === "HANDLED" && answered.body.data.reply === "Oui, samedi matin.", "answered in writing, and handled");
  const order = await api(`/orders/${orderRef}`, { token: orderToken });
  check(order.body?.data?.questions?.[0]?.reply === "Oui, samedi matin.", "the order shows the question and its answer", order.body?.data?.questions);

  // A website message is answered by phone or e-mail, not here.
  const web = await prisma.contactMessage.create({ data: { name: "Site Visitor", phone: "22 111 222", subject: "Depuis le site", body: "Bonjour" } });
  madeQuestions.push(web.id);
  const webReply = await api(`/admin/messages/${web.id}`, { method: "POST", token: staffToken, body: { reply: "Bonjour !" } });
  check(webReply.body?.reason === "not_in_app", "a website message cannot be answered in the app", webReply.body);

  console.log("\n[5] PUSH AND DELETION");
  check((await api("/account/push", { method: "POST", token: phoneToken, body: { token: "nope" } })).status === 422, "push: only an Expo token is accepted");
  const reg = await api("/account/push", { method: "POST", token: phoneToken, body: { token: "ExponentPushToken[reach-test-0001]", locale: "ar" } });
  const sess = await prisma.customerSession.findFirst({ where: { pushToken: "ExponentPushToken[reach-test-0001]" } });
  check(reg.status === 200 && sess?.pushLocale === "ar", "push: kept on this phone's session, in its language");

  const noCode = await api("/account", { method: "DELETE", token: phoneToken, body: { password: "anything" } });
  check(noCode.body?.field === "code", "deleting a password-less account asks for a code", noCode.body);
  const sent = await api("/account/confirm-code", { method: "POST", token: phoneToken, body: { locale: "fr" } });
  check(sent.body?.data?.to?.endsWith(B.slice(-3)), "the code goes to its number, shown masked", sent.body?.data);
  const gone = await api("/account", { method: "DELETE", token: phoneToken, body: { code: codeFor(B) } });
  check(gone.body?.data?.deleted === true, "deleted with the code");
} catch (e) {
  check(false, "threw", String(e).split("\n")[0]);
} finally {
  const phones = numbers.map((n) => `+216${n}`);
  await prisma.user.deleteMany({ where: { OR: [{ email: { in: [EMAIL, EMAIL2] } }, { verifiedPhone: { in: phones } }] } });
  await prisma.phoneCode.deleteMany({ where: { phone: { in: phones } } });
  await prisma.contactMessage.deleteMany({ where: { id: { in: madeQuestions } } });
  if (orderRef) {
    const o = await prisma.order.findUnique({ where: { ref: orderRef }, select: { id: true, items: { select: { productId: true, qty: true } } } });
    if (o) {
      for (const it of o.items) if (it.productId) await prisma.product.update({ where: { id: it.productId }, data: { stockQty: { increment: it.qty } } });
      await prisma.order.delete({ where: { id: o.id } });
    }
  }
  await prisma.$disconnect();
}

console.log(`\n${failures ? `${failures} failure(s)` : "reaching the shop works"}`);
// The battery (scripts/run-e2e.sh) reads this line.
console.log(`${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
