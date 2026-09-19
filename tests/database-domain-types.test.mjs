import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

const { isRoutineFrequency } = loadTypeScriptModule(
  new URL("../src/types/routine.ts", import.meta.url),
);
const { isCheckinItemType } = loadTypeScriptModule(
  new URL("../src/types/checkin.ts", import.meta.url),
);

test("database-backed routine frequencies are narrowed explicitly", () => {
  assert.equal(isRoutineFrequency("daily"), true);
  assert.equal(isRoutineFrequency("weekly"), true);
  assert.equal(isRoutineFrequency("monthly"), false);
});

test("database-backed check-in item types are narrowed explicitly", () => {
  assert.equal(isCheckinItemType("task"), true);
  assert.equal(isCheckinItemType("routine"), true);
  assert.equal(isCheckinItemType("medication"), false);
});
