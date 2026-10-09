import { test } from "node:test";
import assert from "node:assert/strict";

import { matchModels, modelKey, modelYear, narrowEngines, readVin } from "./vin-reading";
import { parseVpic } from "./vin-online";

const now = new Date("2026-10-09T12:00:00Z");

test("character 10 is a model year in a 30-year cycle, never in the future", () => {
  assert.equal(modelYear("F", now), 2015);
  assert.equal(modelYear("6", now), 2006);
  assert.equal(modelYear("Y", now), 2000);
  assert.equal(modelYear("T", now), 2026);
  assert.equal(modelYear("V", now), 2027);
  assert.equal(modelYear("W", now), 1998);
  assert.equal(modelYear("U", now), null);
});

test("a Volkswagen-group VIN names the model and the year", () => {
  assert.deepEqual(readVin("WVWZZZAUZFW123456", now), { makeSlug: "volkswagen", year: 2015, modelNames: ["Golf VII"] });
  assert.deepEqual(readVin("TMBJJ7NJ0GZ123456", now).modelNames, ["Fabia III"]);
  assert.deepEqual(readVin("VSSZZZ6JZBR123456", now), { makeSlug: "seat", year: 2011, modelNames: ["Ibiza IV"] });
});

test("a Peugeot or Renault VIN gives the make only: character 10 is not a year there", () => {
  assert.deepEqual(readVin("VF3LCYHZPHS123456", now), { makeSlug: "peugeot", year: null, modelNames: [] });
  assert.deepEqual(readVin("VF1BM0R0H34123456", now), { makeSlug: "renault", year: null, modelNames: [] });
});

test("an unknown platform code is no model, and an unknown maker is nothing", () => {
  assert.deepEqual(readVin("WVWZZZ99ZFW123456", now).modelNames, []);
  assert.deepEqual(readVin("XYZ12345678901234", now), { makeSlug: null, year: null, modelNames: [] });
});

test("two spellings of one car compare equal", () => {
  assert.equal(modelKey("Golf VII"), modelKey("golf 7"));
  assert.equal(modelKey("Série 1 (E87)"), "serie 1");
  assert.notEqual(modelKey("Golf VI"), modelKey("Golf VII"));
});

const models = [
  { id: "g6", name: "Golf VI", yearFrom: 2008, yearTo: 2012 },
  { id: "g7", name: "Golf 7", yearFrom: 2012, yearTo: 2020 },
  { id: "ib", name: "Ibiza", yearFrom: 2008, yearTo: 2017 },
  { id: "p5", name: "Polo V", yearFrom: 2009, yearTo: 2017 },
];

test("the shop's model is found by its exact name, whatever the numeral", () => {
  assert.deepEqual(matchModels(models, ["Golf VII"], 2015).map((m) => m.id), ["g7"]);
});

test("a bare name matches when its years fit, not otherwise", () => {
  assert.deepEqual(matchModels(models, ["Ibiza IV"], 2011).map((m) => m.id), ["ib"]);
  assert.deepEqual(matchModels(models, ["Ibiza V"], 2019).map((m) => m.id), []);
});

test("a year outside the model's makes no match", () => {
  assert.deepEqual(matchModels(models, ["Golf VII"], 2005).map((m) => m.id), []);
});

const engines = [
  { name: "1.4 TSI", fuel: "Essence", displacementCc: null },
  { name: "1.6 TDI", fuel: "Diesel", displacementCc: null },
  { name: "2.0 TDI", fuel: "Diesel", displacementCc: 1968 },
];

test("engines narrow by fuel and displacement, and never to none", () => {
  assert.deepEqual(narrowEngines(engines, { year: null, fuel: "diesel" }).map((e) => e.name), ["1.6 TDI", "2.0 TDI"]);
  assert.deepEqual(narrowEngines(engines, { year: null, fuel: "diesel", litres: 2.0 }).map((e) => e.name), ["2.0 TDI"]);
  assert.deepEqual(narrowEngines(engines, { year: null, litres: 3.0 }).map((e) => e.name), ["1.4 TSI", "1.6 TDI", "2.0 TDI"]);
});

test("the online answer is kept only when it names the model", () => {
  assert.deepEqual(
    parseVpic({ Results: [{ Make: "KIA", Model: "Sportage", ModelYear: "2017", DisplacementL: "1.685", FuelTypePrimary: "Diesel" }] }),
    { model: "Sportage", year: 2017, litres: 1.7, fuel: "diesel" },
  );
  assert.equal(parseVpic({ Results: [{ Make: "PEUGEOT", Model: "", ModelYear: "2017" }] }), null);
  assert.equal(parseVpic(null), null);
});
