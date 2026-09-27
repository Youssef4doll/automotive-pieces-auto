import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuery } from "./normalize";

test("words spelt by ear are read as the catalogue's word", () => {
  assert.ok(parseQuery("plakette").canonical.includes("plaquette frein"), JSON.stringify(parseQuery("plakette")));
  assert.ok(parseQuery("plakete frein").canonical.includes("plaquette frein"));
});

test("a word that is already right is left alone", () => {
  const q = parseQuery("kit embrayage");
  assert.ok(!q.tokens.includes("cit"));
});
