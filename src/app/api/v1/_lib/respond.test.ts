import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { guard, isTransientDbError, readJson } from "./respond";

describe("a database out of reach is a 503, not a 500", () => {
  it("recognises Prisma's connection failures", () => {
    const known = (code: string) => new Prisma.PrismaClientKnownRequestError("x", { code, clientVersion: "6" });
    for (const code of ["P1001", "P1017", "P2024", "P2034"]) assert.equal(isTransientDbError(known(code)), true, code);
    assert.equal(isTransientDbError(known("P2002")), false);
    assert.equal(isTransientDbError(new Prisma.PrismaClientInitializationError("Can't reach database server", "6")), true);
    assert.equal(isTransientDbError(new Error("Error in PostgreSQL connection: Error { kind: Closed, cause: None }")), true);
    assert.equal(isTransientDbError(new Error("Cannot read properties of undefined")), false);
  });

  it("answers 503 with Retry-After, and 500 for anything else", async () => {
    const down = await guard(async () => {
      throw new Prisma.PrismaClientInitializationError("Can't reach database server at `db:5432`", "6");
    }, "test");
    assert.equal(down.status, 503);
    assert.equal(down.headers.get("retry-after"), "3");
    assert.deepEqual(await down.json(), { error: "temporarily_unavailable" });

    const bug = await guard(async () => {
      throw new TypeError("nope");
    }, "test");
    assert.equal(bug.status, 500);
  });
});

describe("readJson reads no more than the route allows", () => {
  const post = (body: string, headers: Record<string, string> = {}) =>
    new Request("http://x/", { method: "POST", body, headers: { "content-type": "application/json", ...headers } });

  it("parses a body under the ceiling", async () => {
    assert.deepEqual(await readJson(post('{"a":1}'), 64), { a: 1 });
  });
  it("refuses a body over it, declared or not", async () => {
    assert.equal(await readJson(post(JSON.stringify({ a: "x".repeat(200) })), 64), undefined);
    assert.equal(await readJson(post('{"a":1}', { "content-length": "100000" }), 64), undefined);
  });
  it("refuses what is not JSON", async () => {
    assert.equal(await readJson(post("not json"), 64), undefined);
  });
});
