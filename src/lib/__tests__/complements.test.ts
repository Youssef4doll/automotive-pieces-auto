import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { complements } from "../complements";

describe("bought together", () => {
  const pads = { family: "freinage", axle: "AVANT" as const };
  it("front pads go with a front disc", () => {
    assert.equal(complements(pads, { family: "freinage", axle: "AVANT" }), true);
  });
  it("not with a rear disc", () => {
    assert.equal(complements(pads, { family: "freinage", axle: "ARRIERE" }), false);
  });
  it("not with an air filter", () => {
    assert.equal(complements(pads, { family: "filtres", axle: null }), false);
  });
  it("an oil filter goes with engine oil", () => {
    assert.equal(complements({ family: "filtres", axle: null }, { family: "lubrifiant", axle: null }), true);
  });
  it("an unknown family complements only itself", () => {
    assert.equal(complements({ family: "eclairage", axle: null }, { family: "eclairage", axle: null }), true);
    assert.equal(complements({ family: "eclairage", axle: null }, { family: "freinage", axle: null }), false);
  });
});
