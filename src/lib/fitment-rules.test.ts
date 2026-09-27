import { test } from "node:test";
import assert from "node:assert/strict";
import { engineFuelKind, fuelContradicts, fuelNeedOf } from "./fitment-rules";

test("spark plugs and coils are petrol-only", () => {
  assert.equal(fuelNeedOf("allumage-prechauffage-bougie-d-allumage", "Bougie d'allumage NGK BKR6E (x4)"), "PETROL");
  assert.equal(fuelNeedOf("allumage-prechauffage-bobine-d-allumage", "Bobine d'allumage DENSO"), "PETROL");
  assert.equal(fuelNeedOf("x", "Bougie d’allumage BOSCH"), "PETROL");
});

test("glow plugs and DPFs are diesel-only", () => {
  assert.equal(fuelNeedOf("allumage-prechauffage-bougie-de-prechauffage", "Bougie de préchauffage BERU"), "DIESEL");
  assert.equal(fuelNeedOf("echappement-filtre-a-particules", "Filtre à particules"), "DIESEL");
});

test("the family slug alone sets no rule", () => {
  assert.equal(fuelNeedOf("allumage-prechauffage", "Capteur"), null);
  assert.equal(fuelNeedOf("filtres-filtre-a-air", "Filtre à air MANN"), null);
});

test("engine fuel is read loosely, and unknown stays unknown", () => {
  assert.equal(engineFuelKind("Diesel"), "DIESEL");
  assert.equal(engineFuelKind("Essence"), "PETROL");
  assert.equal(engineFuelKind("Hybride essence"), "PETROL");
  assert.equal(engineFuelKind("Électrique"), null);
  assert.equal(engineFuelKind(null), null);
});

test("a spark plug never fits a 320d; a brake disc has no opinion", () => {
  assert.equal(fuelContradicts("allumage-prechauffage-bougie-d-allumage", "Bougie d'allumage NGK", "Diesel"), true);
  assert.equal(fuelContradicts("allumage-prechauffage-bougie-d-allumage", "Bougie d'allumage NGK", "Essence"), false);
  assert.equal(fuelContradicts("freinage-disque-de-frein", "Disque de frein", "Diesel"), false);
});
