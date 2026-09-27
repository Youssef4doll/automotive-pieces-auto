import { test } from "node:test";
import assert from "node:assert/strict";
import { brandInNameMismatch, suspiciousCategoryName } from "./catalog-anomalies";

const BRANDS = ["TOTAL", "DELPHI", "VAICO", "DENSO", "Bosch", "NGK", "TRW"];

test("a product named after another brand is flagged", () => {
  assert.equal(brandInNameMismatch("Bobine d'allumage DELPHI", "TOTAL", BRANDS), "DELPHI");
  assert.equal(brandInNameMismatch("Sonde lambda DENSO", "VAICO", BRANDS), "DENSO");
});

test("its own brand in the name, or no brand at all, is fine", () => {
  assert.equal(brandInNameMismatch("Bougie d'allumage NGK BKR6E", "NGK", BRANDS), null);
  assert.equal(brandInNameMismatch("Filtre à air", "Bosch", BRANDS), null);
  assert.equal(brandInNameMismatch("Plaquettes TRW compatible Bosch", "TRW", BRANDS), null);
});

test("a brand inside another word does not count", () => {
  assert.equal(brandInNameMismatch("Kit TOTALEMENT neuf", "Bosch", BRANDS), null);
});

test("test-looking category names are flagged, real ones are not", () => {
  for (const n of ["rrr", "aa", "xyz", "test catégorie", "Fffreinage"]) assert.equal(suspiciousCategoryName(n), true, n);
  for (const n of ["Freinage", "Balai d'essuie-glace", "Carrosserie", "Kit de plaquettes de frein", "Butée élastique", "Butée embrayage"]) assert.equal(suspiciousCategoryName(n), false, n);
});
