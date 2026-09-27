import { test } from "node:test";
import assert from "node:assert/strict";
import { canPublish, publishChecks } from "./publish-checks";

const base = { name: "Bougie d'allumage NGK BKR6E", priceSell: 32, priceBuy: 20, brandName: "NGK", imageCount: 1, allBrands: ["NGK", "DELPHI", "TOTAL"] };

test("a complete part publishes", () => {
  assert.deepEqual(publishChecks(base), []);
});

test("insane prices block", () => {
  assert.equal(canPublish(publishChecks({ ...base, priceSell: 0 })), false);
  assert.equal(canPublish(publishChecks({ ...base, priceSell: 320000 })), false);
  assert.equal(canPublish(publishChecks({ ...base, priceSell: 15 })), false);
});

test("the brand must be set and match the title", () => {
  assert.equal(canPublish(publishChecks({ ...base, brandName: null })), false);
  assert.equal(canPublish(publishChecks({ ...base, name: "Bobine DELPHI", brandName: "TOTAL" })), false);
});

test("no photo is said, not blocking", () => {
  const checks = publishChecks({ ...base, imageCount: 0 });
  assert.equal(checks.length, 1);
  assert.equal(canPublish(checks), true);
});
