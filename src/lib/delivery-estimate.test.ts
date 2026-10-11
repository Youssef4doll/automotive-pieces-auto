import { test } from "node:test";
import assert from "node:assert/strict";

import { delayDays, estimateDeadline, estimateDelivery, parseClock, parseDays, parseWindow } from "./delivery-estimate";

// Tunis is UTC+1: 13:00 UTC is 14:00 in Tunis.
const at = (iso: string) => new Date(iso);
const SHOP = { cutoff: "14:00", window: "10:00–18:00", days: "1,2,3,4,5,6" };

test("the shop's delays read as whole days", () => {
  assert.deepEqual(delayDays("24h"), [1, 1]);
  assert.deepEqual(delayDays("48–72h"), [2, 3]);
  assert.deepEqual(delayDays("48-72 h"), [2, 3]);
  assert.equal(delayDays("2 à 3 jours ouvrables"), null);
  assert.equal(delayDays(""), null);
  assert.equal(delayDays(null), null);
});

test("clock, window and days parse the ways a shop writes them", () => {
  assert.equal(parseClock("14:00"), 14 * 60);
  assert.equal(parseClock("14h30"), 14 * 60 + 30);
  assert.equal(parseClock("9h"), 9 * 60);
  assert.equal(parseClock("25:00"), null);
  assert.deepEqual(parseWindow("10h–18h"), { start: "10:00", end: "18:00" });
  assert.deepEqual(parseWindow("10:00 - 18:00"), { start: "10:00", end: "18:00" });
  assert.equal(parseWindow("18h–10h"), null);
  assert.equal(parseWindow(""), null);
  assert.deepEqual([...parseDays("1,2,3,4,5,6")!], [1, 2, 3, 4, 5, 6]);
  assert.equal(parseDays("0,8"), null);
});

test("before the cut-off a Grand Tunis order leaves today and arrives the next working day", () => {
  // Monday 5 October 2026, 11:00 in Tunis.
  const e = estimateDelivery({ now: at("2026-10-05T10:00:00Z"), delay: "24h", ...SHOP });
  assert.deepEqual(e, { from: "2026-10-06", to: "2026-10-06", window: { start: "10:00", end: "18:00" } });
});

test("after the cut-off it leaves the next working day", () => {
  // Monday 15:00 in Tunis: leaves Tuesday, arrives Wednesday.
  const e = estimateDelivery({ now: at("2026-10-05T14:00:00Z"), delay: "24h", ...SHOP });
  assert.equal(e?.from, "2026-10-07");
});

test("the cut-off is read in Tunisian time, not the server's", () => {
  // 13:30 UTC is 14:30 in Tunis — past a 14:00 cut-off.
  const e = estimateDelivery({ now: at("2026-10-05T13:30:00Z"), delay: "24h", ...SHOP });
  assert.equal(e?.from, "2026-10-07");
});

test("Sunday is skipped both for leaving and for arriving", () => {
  // Saturday 10 October, 16:00: leaves Monday 12, arrives Tuesday 13.
  const late = estimateDelivery({ now: at("2026-10-10T15:00:00Z"), delay: "24h", ...SHOP });
  assert.equal(late?.from, "2026-10-13");
  // Saturday morning: leaves Saturday, arrives Monday (no courier on Sunday).
  const early = estimateDelivery({ now: at("2026-10-10T08:00:00Z"), delay: "24h", ...SHOP });
  assert.equal(early?.from, "2026-10-12");
});

test("a range of days gives a range of dates", () => {
  // Thursday 8 October, 09:00: leaves Thursday, 48–72h → Saturday to Monday.
  const e = estimateDelivery({ now: at("2026-10-08T08:00:00Z"), delay: "48–72h", ...SHOP });
  assert.equal(e?.from, "2026-10-10");
  assert.equal(e?.to, "2026-10-12");
});

test("no cut-off, no working days or a delay not in hours: no date at all", () => {
  const now = at("2026-10-05T10:00:00Z");
  assert.equal(estimateDelivery({ now, delay: "24h", cutoff: "", window: SHOP.window, days: SHOP.days }), null);
  assert.equal(estimateDelivery({ now, delay: "24h", cutoff: "14:00", window: SHOP.window, days: "" }), null);
  assert.equal(estimateDelivery({ now, delay: "3 jours", ...SHOP }), null);
});

test("without courier hours the date stands alone", () => {
  const e = estimateDelivery({ now: at("2026-10-05T10:00:00Z"), delay: "24h", cutoff: "14:00", window: "", days: SHOP.days });
  assert.equal(e?.window, null);
});

test("the deadline is the close of the window on the last day, in Tunis", () => {
  // 18:00 in Tunis on the 6th is 17:00 UTC.
  assert.equal(estimateDeadline("2026-10-06", { end: "18:00" }).toISOString(), "2026-10-06T17:00:00.000Z");
});
