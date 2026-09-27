import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCode, promoFormProblem, promoVerdict, type PromoRow } from "./promo-rules";

const now = new Date("2026-09-27T12:00:00Z");
const base: PromoRow = {
  code: "ETE10",
  kind: "PERCENT",
  value: 10,
  minSubtotal: null,
  startsAt: null,
  endsAt: null,
  maxUses: null,
  active: true,
};

test("codes are typed the way they are read", () => {
  assert.equal(normalizeCode("  ete 10 "), "ETE10");
  assert.equal(normalizeCode("rentree_2026"), "RENTREE2026");
});

test("a percent code comes off the parts, to the hundredth", () => {
  const v = promoVerdict(base, 123.456, 0, now);
  assert.deepEqual(v, { ok: true, code: "ETE10", kind: "PERCENT", value: 10, discount: 12.35 });
});

test("an amount never takes the parts below zero", () => {
  const v = promoVerdict({ ...base, kind: "AMOUNT", value: 50 }, 30, 0, now);
  assert.equal(v.ok && v.discount, 30);
});

test("a percent above the ceiling is capped, not honoured", () => {
  const v = promoVerdict({ ...base, value: 150 }, 100, 0, now);
  assert.equal(v.ok && v.discount, 90);
});

test("every refusal has its reason", () => {
  assert.deepEqual(promoVerdict(null, 100, 0, now), { ok: false, reason: "unknown" });
  assert.deepEqual(promoVerdict({ ...base, active: false }, 100, 0, now), { ok: false, reason: "inactive" });
  assert.deepEqual(promoVerdict({ ...base, startsAt: new Date("2026-10-01") }, 100, 0, now), { ok: false, reason: "not_started" });
  assert.deepEqual(promoVerdict({ ...base, endsAt: new Date("2026-09-01") }, 100, 0, now), { ok: false, reason: "expired" });
  assert.deepEqual(promoVerdict({ ...base, maxUses: 5 }, 100, 5, now), { ok: false, reason: "used_up" });
  assert.deepEqual(promoVerdict({ ...base, minSubtotal: 200 }, 100, 0, now), { ok: false, reason: "min_subtotal", minSubtotal: 200 });
});

test("the last allowed use still goes through", () => {
  assert.equal(promoVerdict({ ...base, maxUses: 5 }, 100, 4, now).ok, true);
});

test("the admin form refuses what cannot be a promotion", () => {
  const ok = { code: "ETE10", kind: "PERCENT" as const, value: 10, minSubtotal: null, startsAt: null, endsAt: null, maxUses: null };
  assert.equal(promoFormProblem(ok), null);
  assert.ok(promoFormProblem({ ...ok, code: "E" }));
  assert.ok(promoFormProblem({ ...ok, value: 0 }));
  assert.ok(promoFormProblem({ ...ok, value: 95 }));
  assert.ok(promoFormProblem({ ...ok, kind: "AMOUNT", value: 60, minSubtotal: 50 }));
  assert.ok(promoFormProblem({ ...ok, startsAt: new Date("2026-10-02"), endsAt: new Date("2026-10-01") }));
  assert.ok(promoFormProblem({ ...ok, maxUses: 0 }));
});
