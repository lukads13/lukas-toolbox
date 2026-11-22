import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { friendlyError } from "../src/index.js";

test("unbekannter Fehler bleibt allgemein", () => {
  assert.match(friendlyError(new Error("x")), /Interner Fehler/);
});

test("Worker antwortet ohne Login mit 401", async () => {
  const res = await worker.fetch(new Request("https://t/api/tickets"), { ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" });
  assert.equal(res.status, 401);
});
