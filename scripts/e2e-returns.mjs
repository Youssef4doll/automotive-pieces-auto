// Returns end to end, on the LOCAL shop, through every door:
//
//   the app's API    — a request before delivery is refused; after delivery
//                      the rules come back per reason (48 h shop errors, 14
//                      days, warranty) and are enforced (photo, "never
//                      fitted", quantities); a request is filed with a photo;
//                      withdrawn; the windows close when time passes;
//   the staff API    — the shop answers step by step (no skipping), puts the
//                      part back on the shelf, settles a refund; photos are
//                      staff-only;
//   the website      — a guest reopens the order with ref + phone, sees the
//                      request and its answers, files a second one through
//                      the form; the admin refuses it in /admin/retours and
//                      the customer reads why.
//
//   node scripts/e2e-returns.mjs
//
// Cleans up after itself: the order (and with it every request) and the stock.
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { waitForAdmin } from "./lib/wait-for-admin.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PICS = process.env.PICS_DIR || ".e2e-fixtures";
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error("e2e-returns: local shop only");
  process.exit(1);
}
const prisma = new PrismaClient();

let failures = 0;
let passes = 0;
const check = (cond, what, detail) => {
  if (!cond) failures++;
  else passes++;
  console.log(`${cond ? "ok  " : "FAIL"}  ${what}${detail !== undefined ? " " + JSON.stringify(detail) : ""}`);
};
const api = async (path, init = {}) => {
  const res = await fetch(`${BASE}/api/v1${path}`, init);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};
const json = (method, body, token) => ({
  method,
  headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const png = new Blob([await readFile(`${PICS}/pad-front.png`)], { type: "image/png" });
const fileReturn = (ref, token, request, photos = 0) => {
  const form = new FormData();
  form.set("request", JSON.stringify(request));
  for (let i = 0; i < photos; i++) form.append("photos", png, `p${i}.png`);
  return api(`/orders/${ref}/returns`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
};

const part = await prisma.product.findFirst({
  where: { active: true, stockQty: { gt: 4 }, priceSell: { gte: 20, lte: 200 } },
  select: { id: true, name: true, stockQty: true },
});
const engine = await prisma.vehicleEngine.findFirst({ select: { id: true } });
const stockBefore = part.stockQty;
let orderId = null;

try {
  // ---- a delivered order, placed as the app places one, for a car
  const placed = await api(
    "/orders",
    json("POST", {
      customerName: "Retour Essai",
      phone: "22 445 667",
      governorate: "Sfax",
      address: "3 rue du Retour, Sfax",
      deliveryMethod: "DELIVERY",
      paymentMethod: "COD",
      vehicleEngineId: engine?.id,
      items: [{ productId: part.id, qty: 2 }],
    }),
  );
  const ref = placed.body?.data?.ref;
  const token = placed.body?.data?.token;
  check(Boolean(ref && token), "order placed from the app", ref);
  orderId = (await prisma.order.findUnique({ where: { ref }, select: { id: true } }))?.id;
  const lineId = placed.body.data.order.items[0].id;
  check(typeof lineId === "string", "the order view carries each line's id");
  check(placed.body.data.order.returnOptions === null, "before delivery: no return options");

  const early = await fileReturn(ref, token, { reason: "NOT_NEEDED", wish: "REFUND", unmounted: true, items: [{ orderItemId: lineId, qty: 1 }] });
  check(early.status === 409 && early.body?.reason === "not_delivered", "before delivery: a request is refused", early.body);

  // ---- the staff side marks it delivered
  const session = await api("/admin/session", json("POST", { email: "admin@automotive-pieces-auto.tn", password: "admin1234" }));
  const staff = session.body?.data?.token;
  check(Boolean(staff), "staff signed in on the API");
  const moved = await api(`/admin/orders/${orderId}/status`, json("POST", { status: "DELIVERED" }, staff));
  check(moved.status === 200, "staff: order marked delivered");

  const view = (await api(`/orders/${ref}`, { headers: { authorization: `Bearer ${token}` } })).body?.data;
  const opts = Object.fromEntries((view?.returnOptions?.reasons ?? []).map((r) => [r.reason, r]));
  check(opts.WRONG_PART?.open && opts.WRONG_PART.cover === "shop" && opts.WRONG_PART.photo === "required", "delivered: « pas la bonne pièce » is the shop's error, photo required");
  check(opts.DOES_NOT_FIT?.cover === (engine ? "shop" : "standard"), "delivered: a misfit on the car we were given is the shop's error", opts.DOES_NOT_FIT);
  check(opts.DEFECTIVE?.cover === "warranty" && opts.NOT_NEEDED?.cover === "standard", "warranty and 14-day returns are told apart");
  check(view?.returnOptions?.items?.[0]?.returnable === 2, "both parts are free to return");

  // ---- the rules, enforced by the shop
  const noPhoto = await fileReturn(ref, token, { reason: "DAMAGED", wish: "EXCHANGE", items: [{ orderItemId: lineId, qty: 1 }] });
  check(noPhoto.status === 422 && noPhoto.body?.reason === "photo_required", "a damaged part needs a photo", noPhoto.body);
  const mounted = await fileReturn(ref, token, { reason: "NOT_NEEDED", wish: "REFUND", unmounted: false, items: [{ orderItemId: lineId, qty: 1 }] });
  check(mounted.status === 422 && mounted.body?.reason === "unmounted_required", "a 14-day return needs « never fitted »", mounted.body);
  const tooMany = await fileReturn(ref, token, { reason: "NOT_NEEDED", wish: "REFUND", unmounted: true, items: [{ orderItemId: lineId, qty: 3 }] });
  check(tooMany.status === 422 && tooMany.body?.reason === "qty", "no more than was bought", tooMany.body);
  const stranger = await fileReturn(ref, "x".repeat(43), { reason: "NOT_NEEDED", wish: "REFUND", unmounted: true, items: [{ orderItemId: lineId, qty: 1 }] });
  check(stranger.status === 404, "a wrong key files nothing", stranger.status);

  // ---- a real request, with a photo
  const filed = await fileReturn(ref, token, { reason: "DOES_NOT_FIT", wish: "EXCHANGE", unmounted: true, note: "Le connecteur n'est pas le même.", items: [{ orderItemId: lineId, qty: 1 }] }, 1);
  const retRef = filed.body?.data?.returnRef;
  check(filed.status === 200 && /^RET-\d+$/.test(retRef ?? ""), "request filed with a photo", retRef);
  const afterFile = filed.body?.data?.order;
  check(afterFile?.returns?.[0]?.status === "REQUESTED" && afterFile.returns[0].photoCount === 1, "the order shows it, requested, with its photo");
  check(afterFile?.returnOptions?.items?.[0]?.returnable === 1, "one part left free to return");

  // ---- withdraw a second one
  const second = await fileReturn(ref, token, { reason: "NOT_NEEDED", wish: "REFUND", unmounted: true, items: [{ orderItemId: lineId, qty: 1 }] });
  const secondRef = second.body?.data?.returnRef;
  const withdrawn = await api(`/orders/${ref}/returns/${secondRef}/cancel`, json("POST", undefined, token));
  check(withdrawn.status === 200 && withdrawn.body?.data?.returns?.find((r) => r.ref === secondRef)?.status === "CANCELLED", "a request can be withdrawn before the shop answers");
  check(withdrawn.body?.data?.returnOptions?.items?.[0]?.returnable === 1, "withdrawing frees the part again");

  // ---- the shop answers
  const list = await api("/admin/returns", { headers: { authorization: `Bearer ${staff}` } });
  const row = list.body?.data?.returns?.find((r) => r.ref === retRef);
  check(Boolean(row) && list.body.data.counts.requested >= 1, "staff: listed among the open requests");
  const detail = (await api(`/admin/returns/${row.id}`, { headers: { authorization: `Bearer ${staff}` } })).body?.data;
  check(detail?.photoIds?.length === 1 && detail.next.includes("APPROVED"), "staff: the detail has the photo and the next steps");
  const photoAnon = await fetch(`${BASE}/api/v1/admin/returns/photos/${detail.photoIds[0]}`);
  const photoStaff = await fetch(`${BASE}/api/v1/admin/returns/photos/${detail.photoIds[0]}`, { headers: { authorization: `Bearer ${staff}` } });
  check(photoAnon.status === 401 && photoStaff.status === 200 && photoStaff.headers.get("content-type") === "image/png", "the customer's photo is for staff only");

  const skip = await api(`/admin/returns/${row.id}`, json("POST", { to: "RESOLVED", outcome: "EXCHANGED" }, staff));
  check(skip.status === 409, "staff: a step cannot be skipped", skip.status);
  const approved = await api(`/admin/returns/${row.id}`, json("POST", { to: "APPROVED", method: "DROP_OFF", shopNote: "Passez au comptoir avec la pièce." }, staff));
  check(approved.body?.data?.status === "APPROVED", "staff: accepted, drop-off");
  const customerSees = (await api(`/orders/${ref}`, { headers: { authorization: `Bearer ${token}` } })).body?.data?.returns?.find((r) => r.ref === retRef);
  check(customerSees?.method === "DROP_OFF" && customerSees.shopNote === "Passez au comptoir avec la pièce.", "customer: sees how to bring it back, and the shop's words");
  const late = await api(`/orders/${ref}/returns/${retRef}/cancel`, json("POST", undefined, token));
  check(late.status === 409, "customer: an answered request can no longer be withdrawn");

  const stockMid = (await prisma.product.findUnique({ where: { id: part.id }, select: { stockQty: true } })).stockQty;
  const received = await api(`/admin/returns/${row.id}`, json("POST", { to: "RECEIVED", restock: true }, staff));
  const stockAfter = (await prisma.product.findUnique({ where: { id: part.id }, select: { stockQty: true } })).stockQty;
  check(received.body?.data?.status === "RECEIVED" && stockAfter === stockMid + 1, "staff: received, and the part is back on the shelf", { stockMid, stockAfter });
  const noAmount = await api(`/admin/returns/${row.id}`, json("POST", { to: "RESOLVED", outcome: "REFUNDED" }, staff));
  check(noAmount.status === 422, "staff: a refund needs its amount");
  const resolved = await api(`/admin/returns/${row.id}`, json("POST", { to: "RESOLVED", outcome: "REFUNDED", refundAmount: 25.5 }, staff));
  check(resolved.body?.data?.status === "RESOLVED" && resolved.body.data.refundAmount === 25.5, "staff: settled, refunded");
  const settled = (await api(`/orders/${ref}`, { headers: { authorization: `Bearer ${token}` } })).body?.data?.returns?.find((r) => r.ref === retRef);
  check(settled?.outcome === "REFUNDED" && settled.refundAmount === 25.5 && settled.resolvedAt, "customer: sees the refund and its amount");

  // ---- the website: a guest reopens the order and files a second request
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  try {
    const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    guest.on("pageerror", (e) => console.log("  PAGE ERROR:", e.message));
    await guest.goto(`${BASE}/suivi`);
    await guest.fill('input[name="ref"]', ref).catch(async () => guest.getByLabel(/numéro de commande/i).fill(ref));
    await guest.fill('input[name="phone"]', "22445667").catch(async () => guest.getByLabel(/téléphone/i).fill("22445667"));
    await guest.getByRole("button", { name: "Voir ma commande" }).click();
    await guest.waitForURL(/confirmation/, { timeout: 15000 }).catch(() => {});
    await guest.waitForTimeout(800);
    const page1 = await guest.locator("body").innerText();
    check(page1.includes(retRef) && /Remboursée/.test(page1), "website: the guest sees the request, settled and refunded");
    check(/retourner une pièce/i.test(page1), "website: the order offers « Retourner une pièce »");

    await guest.getByRole("link", { name: "Retourner une pièce" }).click();
    await guest.waitForURL(/\/retour$/, { timeout: 15000 });
    await guest.getByLabel(/Quantité à retourner/).selectOption("1");
    await guest.getByLabel("Je n'en ai plus besoin").check();
    await guest.getByRole("button", { name: "Envoyer la demande" }).click();
    await guest.waitForTimeout(600);
    check(await guest.getByText("Confirmez que la pièce n'a pas été montée").isVisible(), "website form: asks for « never fitted » first");
    await guest.getByLabel(/La pièce n.a pas été montée/).check();
    await guest.getByRole("button", { name: "Envoyer la demande" }).click();
    await guest.waitForURL(/confirmation\/.*retour=RET-/, { timeout: 15000 }).catch(() => {});
    const websiteRef = new URL(guest.url()).searchParams.get("retour");
    check(/^RET-\d+$/.test(websiteRef ?? ""), "website: a second request filed through the form", websiteRef);

    // ---- the admin refuses it in /admin/retours
    const admin = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
    await admin.goto(`${BASE}/compte`);
    await admin.fill('input[name="email"]', "admin@automotive-pieces-auto.tn");
    await admin.fill('input[name="password"]', "admin1234");
    await admin.getByRole("button", { name: "Se connecter", exact: true }).click();
    await waitForAdmin(admin, BASE);
    await admin.goto(`${BASE}/admin/retours`);
    check((await admin.getByText(websiteRef).count()) > 0, "admin: the new request is in /admin/retours");
    check((await admin.locator('a[href="/admin/retours"] span').count()) > 0, "admin: the menu counts requests waiting");
    await admin.getByText(websiteRef).first().click();
    await admin.waitForURL(/\/admin\/retours\/.+/);
    check(await admin.getByText("Retour sous 14 jours").isVisible(), "admin: the policy's line for this case is shown");
    await admin.getByLabel(/Refuser — pourquoi/).fill("La pièce a été montée : elle ne peut plus être reprise.");
    await admin.getByRole("button", { name: "Refuser la demande" }).click();
    await admin.waitForTimeout(1500);
    check((await admin.getByText("Refusée").count()) > 0, "admin: refused, with a reason");

    await guest.reload();
    const page2 = await guest.locator("body").innerText();
    check(page2.includes("La pièce a été montée : elle ne peut plus être reprise."), "website: the customer reads why");
  } finally {
    await browser.close();
  }

  // ---- time passes: the windows close
  await prisma.orderStatusEvent.updateMany({ where: { orderId, status: "DELIVERED" }, data: { createdAt: new Date(Date.now() - 3 * 86_400_000) } });
  const later = Object.fromEntries(((await api(`/orders/${ref}`, { headers: { authorization: `Bearer ${token}` } })).body?.data?.returnOptions?.reasons ?? []).map((r) => [r.reason, r]));
  check(!later.DAMAGED?.open && later.NOT_NEEDED?.open && later.DOES_NOT_FIT?.cover === "standard", "after 3 days: shop-error reports closed, the 14-day return open");
  await prisma.orderStatusEvent.updateMany({ where: { orderId, status: "DELIVERED" }, data: { createdAt: new Date(Date.now() - 20 * 86_400_000) } });
  const lateReq = await fileReturn(ref, token, { reason: "NOT_NEEDED", wish: "REFUND", unmounted: true, items: [{ orderItemId: lineId, qty: 1 }] });
  check(lateReq.status === 422 && lateReq.body?.reason === "closed", "after 20 days: a 14-day return is refused as closed", lateReq.body);
} catch (e) {
  check(false, "threw", String(e).split("\n")[0]);
} finally {
  if (orderId) await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
  await prisma.product.update({ where: { id: part.id }, data: { stockQty: stockBefore } });
  await prisma.$disconnect();
}

console.log(failures ? `\n${failures} failure(s)` : "\nreturns work end to end");
// The battery (scripts/run-e2e.sh) reads this line.
console.log(`${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
