import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

const filterTasksForToday = (tasks) => tasks.filter((task) => !task.is_done);
const {
  checkinItemKey,
  completionMapFromItems,
  tasksForDailyCheckin,
} = loadTypeScriptModule(
  new URL("../src/lib/checkinProgress.ts", import.meta.url),
  { "@/lib/today": { filterTasksForToday } },
);

test("daily completion keys are stable across dashboard and check-in", () => {
  assert.equal(checkinItemKey("routine", "abc"), "routine:abc");
  assert.equal(checkinItemKey("task", "abc"), "task:abc");
});

test("completion maps preserve explicit incomplete state", () => {
  assert.deepEqual(
    completionMapFromItems([
      { item_type: "routine", item_id: "walk", completed: true },
      { item_type: "task", item_id: "email", completed: false },
    ]),
    {
      "routine:walk": true,
      "task:email": false,
    },
  );
});

test("finished tasks already recorded today remain visible in check-in", () => {
  const tasks = [
    { id: "open", is_done: false },
    { id: "finished-today", is_done: true },
    { id: "old-finished", is_done: true },
  ];
  const rows = tasksForDailyCheckin(
    tasks,
    [{ item_type: "task", item_id: "finished-today", completed: true }],
    new Date(),
  );

  assert.deepEqual(
    rows.map((task) => task.id),
    ["open", "finished-today"],
  );
});
