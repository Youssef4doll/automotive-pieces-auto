import { test } from "node:test";
import assert from "node:assert/strict";
import { fitVerdict, sameEngineCode, type FitEvidence } from "./fitment-verdict";

const none: FitEvidence = { mine: null, sameModel: false, sameCode: false, wrongFuel: false };

test("only a VERIFIED row for this engine fits", () => {
  assert.equal(fitVerdict({ ...none, mine: "VERIFIED" }), "FITS");
  assert.equal(fitVerdict({ ...none, mine: "DERIVED" }), "UNKNOWN");
});

test("no evidence is 'to check', never 'does not fit'", () => {
  assert.equal(fitVerdict(none), "UNKNOWN");
});

test("the same engine code under another model is a lead, not a yes", () => {
  assert.equal(fitVerdict({ ...none, sameCode: true }), "UNKNOWN");
  assert.equal(fitVerdict({ ...none, sameCode: true, sameModel: true }), "UNKNOWN");
});

test("a model covered without this engine does not fit", () => {
  assert.equal(fitVerdict({ ...none, sameModel: true }), "DOES_NOT_FIT");
});

test("the wrong fuel never fits, whatever the rows say", () => {
  assert.equal(fitVerdict({ ...none, mine: "VERIFIED", wrongFuel: true }), "DOES_NOT_FIT");
});

test("engine codes compare loosely", () => {
  assert.equal(sameEngineCode("K9K 612", "k9k-612"), true);
  assert.equal(sameEngineCode("K9K", null), false);
  assert.equal(sameEngineCode("N47D20", "M47D20"), false);
});
