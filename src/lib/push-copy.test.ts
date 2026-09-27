import { test } from "node:test";
import assert from "node:assert/strict";
import { backInStockPush, EXPO_TOKEN, orderLabel, orderStatusPush, pushLocale } from "./push-copy";

test("an order is named by what is in it", () => {
  assert.equal(orderLabel("Amortisseur avant SACHS", 0), "Amortisseur avant SACHS");
  assert.equal(orderLabel("Amortisseur avant SACHS", 2), "Amortisseur avant SACHS + 2");
  assert.ok(orderLabel("x".repeat(80), 0).length <= 48);
});

test("each status says what happened, in the phone's language", () => {
  assert.equal(orderStatusPush("SHIPPED", "fr", "Filtre", "DELIVERY")?.title, "Commande en route");
  assert.equal(orderStatusPush("SHIPPED", "en", "Filtre", "DELIVERY")?.title, "Order on its way");
  assert.equal(orderStatusPush("DELIVERED", "ar", "Filtre", "DELIVERY")?.title, "تم تسليم الطلب");
});

test("prepared only wakes a phone for a pickup", () => {
  assert.equal(orderStatusPush("PREPARED", "fr", "Filtre", "DELIVERY"), null);
  assert.equal(orderStatusPush("PREPARED", "fr", "Filtre", "PICKUP")?.title, "Commande prête");
  assert.equal(orderStatusPush("PENDING", "fr", "Filtre", "DELIVERY"), null);
});

test("no sentence promises a date", () => {
  for (const loc of ["fr", "en"] as const) {
    for (const s of ["CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const) {
      const body = orderStatusPush(s, loc, "Filtre", "DELIVERY")?.body ?? "";
      assert.doesNotMatch(body, /demain|tomorrow|\d+\s?(h|jours|days)/i);
    }
  }
});

test("unknown locales fall back to French", () => {
  assert.equal(pushLocale("de"), "fr");
  assert.equal(pushLocale("ar"), "ar");
});

test("back in stock names the part", () => {
  assert.match(backInStockPush("fr", "Filtre à huile").body, /Filtre à huile/);
});

test("only Expo tokens are accepted", () => {
  assert.ok(EXPO_TOKEN.test("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"));
  assert.ok(EXPO_TOKEN.test("ExpoPushToken[abcdefgh1234]"));
  assert.ok(!EXPO_TOKEN.test("https://evil.example/"));
  assert.ok(!EXPO_TOKEN.test("ExponentPushToken[]"));
});
