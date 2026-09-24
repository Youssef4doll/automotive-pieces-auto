import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { availabilityOf } from "@/lib/availability";
import { toNumber } from "@/lib/money";
import { looksLikeReference, normalizeReference } from "@/lib/reference";
import { computeSegment } from "@/lib/segment";
import { taxBreakdown, taxPolicy } from "@/lib/tax";
import { nameProblem, phoneProblem, signupSchema } from "@/lib/validation";
import { decodeVinMakeSlug, isValidVinFormat } from "@/lib/vin";
import type { SettingsMap } from "@/lib/settings";

/**
 * The shop's rules that are plain functions — the ones both front doors
 * rely on and the server enforces. Everything with a database or a request
 * is exercised by the e2e suites; these hold the arithmetic and the
 * thresholds still.
 */

describe("names and phones (checkout, signup, app)", () => {
  it("accepts Latin and Arabic names, apostrophes, hyphens", () => {
    for (const n of ["Amina Ben Salah", "بن صالح", "M'hamed", "Abd el-Kader", "AB"]) assert.equal(nameProblem(n), null, n);
  });
  it("refuses an e-mail, a web address, digits, a single letter", () => {
    for (const n of ["ttttt@gmail.com", "www.site.tn", "12345", "a", "...."]) assert.notEqual(nameProblem(n), null, n);
  });
  it("counts eight digits whatever the separators", () => {
    for (const p of ["20445566", "+216 20 445 566", "20 44 55 66"]) assert.equal(phoneProblem(p), null, p);
    assert.notEqual(phoneProblem("2044"), null);
    assert.notEqual(phoneProblem("1".repeat(31)), null);
  });
});

describe("signup schema (website form and app API)", () => {
  const ok = { name: "Amina Ben Salah", email: "amina@exemple.tn", phone: "20445566", password: "secret1" };
  it("accepts a complete account", () => {
    assert.equal(signupSchema.safeParse(ok).success, true);
  });
  it("names the field it refuses", () => {
    const r = signupSchema.safeParse({ ...ok, name: "x@y.tn" });
    assert.equal(r.success, false);
    assert.equal(r.success ? null : r.error.issues[0]?.path[0], "name");
  });
  it("holds passwords between 6 and 72 characters (bcrypt reads 72 bytes)", () => {
    assert.equal(signupSchema.safeParse({ ...ok, password: "12345" }).success, false);
    assert.equal(signupSchema.safeParse({ ...ok, password: "x".repeat(73) }).success, false);
    assert.equal(signupSchema.safeParse({ ...ok, password: "x".repeat(72) }).success, true);
  });
});

describe("availability is derived, never typed in", () => {
  it("stock first, then the supply mode", () => {
    assert.equal(availabilityOf({ stockQty: 3, supply: "UNAVAILABLE" }), "IN_STOCK");
    assert.equal(availabilityOf({ stockQty: 0, supply: "ON_ORDER" }), "ON_ORDER");
    assert.equal(availabilityOf({ stockQty: 0, supply: "UNAVAILABLE" }), "UNAVAILABLE");
    assert.equal(availabilityOf({ stockQty: -2, supply: "ON_ORDER" }), "ON_ORDER");
  });
});

describe("references", () => {
  it("normalise the ways people write the same number", () => {
    const n = normalizeReference("7701 234-567");
    assert.equal(n, "7701234567");
    assert.equal(normalizeReference("77 01 234 567"), n);
    assert.equal(normalizeReference("0 986 424 201"), "0986424201");
  });
  it("tell a reference from a word", () => {
    assert.equal(looksLikeReference("GDB1330"), true);
    assert.equal(looksLikeReference("0 986 424 201"), true);
    assert.equal(looksLikeReference("frein"), false);
    assert.equal(looksLikeReference("plaquettes avant 2"), false);
  });
});

describe("VIN", () => {
  it("checks the 17-character shape, without I, O or Q", () => {
    assert.equal(isValidVinFormat("WBAUE11040E123456"), true);
    assert.equal(isValidVinFormat("WBAUE11040E12345"), false);
    assert.equal(isValidVinFormat("WBAUE11O40E123456"), false);
  });
  it("names a maker only from a known WMI, never guesses", () => {
    assert.equal(decodeVinMakeSlug("WBAUE11040E123456"), "bmw");
    assert.equal(decodeVinMakeSlug("VF1AAAAA"), "renault");
    assert.equal(decodeVinMakeSlug("XYZ12345678901234"), null);
  });
});

describe("tax", () => {
  const settings = (patch: Partial<SettingsMap>) =>
    ({ shop_tax_id: "", vat_rate: "19", stamp_duty: "1", ...patch }) as unknown as SettingsMap;
  it("charges nothing until the shop has a matricule fiscal", () => {
    assert.deepEqual(taxPolicy(settings({})), { vatRate: 0, stampDuty: 0 });
    assert.deepEqual(taxPolicy(settings({ shop_tax_id: "1234567A" })), { vatRate: 19, stampDuty: 1 });
  });
  it("decomposes TTC prices so the lines add up to the total exactly", () => {
    const b = taxBreakdown({ subtotal: 89, shippingFee: 7, vatRate: 19, stampDuty: 1 });
    assert.equal(b.taxed, true);
    assert.equal(b.total, 97);
    assert.equal(Math.round((b.goodsHT + b.shippingHT + b.vat + b.stampDuty) * 100) / 100, b.total);
  });
  it("shows no VAT line for an untaxed shop", () => {
    const b = taxBreakdown({ subtotal: 50, shippingFee: 0, vatRate: 0, stampDuty: 0 });
    assert.equal(b.taxed, false);
    assert.equal(b.vat, 0);
    assert.equal(b.total, 50);
  });
});

describe("money and segments", () => {
  it("reads Prisma decimals, strings and nulls", () => {
    assert.equal(toNumber({ toNumber: () => 12.5 }), 12.5);
    assert.equal(toNumber("7.30"), 7.3);
    assert.equal(toNumber(null), 0);
  });
  it("derives the customer segment from real orders", () => {
    assert.equal(computeSegment(0, 0), "NEW");
    assert.equal(computeSegment(2, 150), "REGULAR");
    assert.equal(computeSegment(5, 100), "VIP");
    assert.equal(computeSegment(1, 1000), "VIP");
  });
});
