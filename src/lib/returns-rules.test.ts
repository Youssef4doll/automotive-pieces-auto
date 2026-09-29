import { test } from "node:test";
import assert from "node:assert/strict";
import { returnOptions, returnProblem, returnValue, returnableQty, RETURN_NEXT } from "./returns-rules";

const delivered = new Date("2026-09-10T10:00:00Z");
const at = (hours: number) => new Date(delivered.getTime() + hours * 3_600_000);
const byReason = (opts: ReturnType<typeof returnOptions>) => Object.fromEntries(opts.map((o) => [o.reason, o]));

test("within 48 hours, every reason is open and the shop's errors are at its charge", () => {
  const o = byReason(returnOptions(delivered, true, at(20)));
  assert.equal(o.WRONG_PART.open, true);
  assert.equal(o.WRONG_PART.cover, "shop");
  assert.equal(o.WRONG_PART.photo, "required");
  assert.equal(o.DAMAGED.cover, "shop");
  assert.equal(o.DOES_NOT_FIT.cover, "shop");
  assert.equal(o.DOES_NOT_FIT.unmounted, true);
  assert.equal(o.NOT_NEEDED.cover, "standard");
  assert.equal(o.DEFECTIVE.cover, "warranty");
});

test("a misfit is the shop's error only when the car was given", () => {
  const o = byReason(returnOptions(delivered, false, at(20)));
  assert.equal(o.DOES_NOT_FIT.cover, "standard");
  assert.equal(o.DOES_NOT_FIT.photo, "optional");
});

test("after 48 hours the shop-error reports close; the 14-day return stays open", () => {
  const o = byReason(returnOptions(delivered, true, at(49)));
  assert.equal(o.WRONG_PART.open, false);
  assert.equal(o.DAMAGED.open, false);
  assert.equal(o.DOES_NOT_FIT.open, true);
  assert.equal(o.DOES_NOT_FIT.cover, "standard");
  assert.equal(o.NOT_NEEDED.open, true);
});

test("after 14 days only the warranty is left, for 12 months", () => {
  const o = byReason(returnOptions(delivered, true, at(14 * 24 + 1)));
  assert.equal(o.DOES_NOT_FIT.open, false);
  assert.equal(o.NOT_NEEDED.open, false);
  assert.equal(o.DEFECTIVE.open, true);
  assert.equal(o.DEFECTIVE.until, "2027-09-10T10:00:00.000Z");
  assert.equal(byReason(returnOptions(delivered, true, new Date("2027-09-11T00:00:00Z"))).DEFECTIVE.open, false);
});

test("quantities already in a live request are not free again", () => {
  const free = returnableQty([{ id: "a", qty: 2 }, { id: "b", qty: 1 }], [{ orderItemId: "a", qty: 1 }]);
  assert.equal(free.get("a"), 1);
  assert.equal(free.get("b"), 1);
});

test("a request is checked again on the server, first problem first", () => {
  const options = returnOptions(delivered, true, at(20));
  const free = new Map([["a", 1]]);
  const base = { reason: "NOT_NEEDED" as const, items: [{ orderItemId: "a", qty: 1 }], photos: 0, unmounted: true };
  assert.equal(returnProblem(base, options, free), null);
  assert.equal(returnProblem({ ...base, items: [] }, options, free), "no_items");
  assert.equal(returnProblem({ ...base, items: [{ orderItemId: "a", qty: 2 }] }, options, free), "qty");
  assert.equal(returnProblem({ ...base, items: [{ orderItemId: "zz", qty: 1 }] }, options, free), "qty");
  assert.equal(returnProblem({ ...base, items: [{ orderItemId: "a", qty: 1 }, { orderItemId: "a", qty: 1 }] }, options, new Map([["a", 2]])), "qty");
  assert.equal(returnProblem({ ...base, unmounted: false }, options, free), "unmounted_required");
  assert.equal(returnProblem({ ...base, reason: "DAMAGED" }, options, free), "photo_required");
  assert.equal(returnProblem({ ...base, reason: "DAMAGED", photos: 1 }, options, free), null);
  assert.equal(returnProblem({ ...base, reason: "DAMAGED", photos: 1 }, returnOptions(delivered, true, at(60)), free), "closed");
});

test("the value is at the prices charged, to the millime's hundredth", () => {
  assert.equal(returnValue([{ qty: 2, unitPrice: 12.345 }, { qty: 1, unitPrice: 0.1 }]), 24.79);
});

test("a withdrawn or refused request is final", () => {
  assert.deepEqual(RETURN_NEXT.CANCELLED, []);
  assert.deepEqual(RETURN_NEXT.REFUSED, []);
  assert.ok(RETURN_NEXT.REQUESTED.includes("CANCELLED"));
  assert.ok(!RETURN_NEXT.APPROVED.includes("CANCELLED"));
});
