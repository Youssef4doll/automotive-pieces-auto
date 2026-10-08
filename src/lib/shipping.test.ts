import { test } from "node:test";
import assert from "node:assert/strict";

import { FLAT_DELIVERY_FEE, shippingFeeFor, waivedDeliveryFee } from "./shipping";

test("delivery under the threshold is charged and nothing is waived", () => {
  assert.equal(shippingFeeFor(100, 150), FLAT_DELIVERY_FEE);
  assert.equal(waivedDeliveryFee(100, 150), 0);
});

test("delivery over the threshold is free and the waived fee is the flat one", () => {
  assert.equal(shippingFeeFor(150, 150), 0);
  assert.equal(waivedDeliveryFee(150, 150), FLAT_DELIVERY_FEE);
});

test("pickup never costs delivery, so nothing is struck through", () => {
  assert.equal(shippingFeeFor(200, 150, "PICKUP"), 0);
  assert.equal(waivedDeliveryFee(200, 150, "PICKUP"), 0);
});

test("an empty basket waives nothing", () => {
  assert.equal(waivedDeliveryFee(0, 0), 0);
});
