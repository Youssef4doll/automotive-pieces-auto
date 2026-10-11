import { test } from "node:test";
import assert from "node:assert/strict";

import { frenchClock, frenchEstimate, orderDelayText, orderStatusText, type TextOrder } from "./order-texts-copy";

const order: TextOrder = {
  shop: "Automotive Pièces Auto",
  ref: "CMD-1042",
  total: "138,600 DT",
  deliveryMethod: "DELIVERY",
  estimate: { from: "2026-10-06", to: "2026-10-06", window: { start: "10:00", end: "18:00" } },
};

test("the estimate reads as the owner wrote it", () => {
  assert.equal(frenchClock("10:00"), "10 h");
  assert.equal(frenchClock("09:30"), "9 h 30");
  assert.equal(frenchEstimate(order.estimate!), "mardi 6 octobre, 10 h–18 h");
  assert.equal(frenchEstimate({ from: "2026-10-08", to: "2026-10-10", window: null }), "entre jeudi 8 et samedi 10 octobre");
  assert.equal(frenchEstimate({ from: "2026-10-30", to: "2026-11-02", window: null }), "entre vendredi 30 octobre et lundi 2 novembre");
});

test("each step has its message, and the van is the one that says the courier calls", () => {
  assert.match(orderStatusText("CONFIRMED", order)!, /CMD-1042 est confirmée\. Livraison estimée : mardi 6 octobre, 10 h–18 h\./);
  assert.match(orderStatusText("SHIPPED", order)!, /en route — le livreur vous appelle avant de passer\. À payer à la livraison : 138,600 DT\./);
  assert.match(orderStatusText("DELIVERED", order)!, /3 gestes/);
  assert.match(orderStatusText("PENDING", order)!, /bien reçue \(138,600 DT/);
});

test("no estimate, no date in the message", () => {
  const text = orderStatusText("CONFIRMED", { ...order, estimate: null })!;
  assert.doesNotMatch(text, /estimée/);
});

test("a delivery's PREPARED is silent; a pickup's says come and get it", () => {
  assert.equal(orderStatusText("PREPARED", order), null);
  assert.match(orderStatusText("PREPARED", { ...order, deliveryMethod: "PICKUP", estimate: null })!, /prête au magasin/);
});

test("the delay names the day it will miss, or the window, and what happens next", () => {
  assert.match(orderDelayText({ ...order, shipped: false }), /n'arrivera pas mardi 6 octobre comme prévu\. Nous vous prévenons dès qu'elle part\./);
  assert.match(
    orderDelayText({ ...order, estimate: { from: "2026-10-08", to: "2026-10-10", window: null }, shipped: true }),
    /dans les délais annoncés\. Elle est chez le livreur/,
  );
});
