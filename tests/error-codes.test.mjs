import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

const { getErrorCode, getErrorMessage } = loadTypeScriptModule(
  new URL("../src/lib/errors.ts", import.meta.url),
);

test("database machine error codes can be handled without displaying them raw", () => {
  const error = { message: "insufficient_recovery_points" };

  assert.equal(getErrorCode(error), "insufficient_recovery_points");
  assert.equal(getErrorMessage(error, "friendly fallback"), "friendly fallback");
});

test("human-readable or technical messages are not treated as domain codes", () => {
  assert.equal(getErrorCode({ message: "You need 30 recovery points." }), null);
  assert.equal(getErrorCode({ message: "permission denied" }), null);
  assert.equal(getErrorCode(new Error("day_already_repaired")), "day_already_repaired");
});
