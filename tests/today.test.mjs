import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

const { filterTasksForToday, getLocalDateKey, routineOccursOn } =
  loadTypeScriptModule(new URL("../src/lib/today.ts", import.meta.url));

function task(id, dueAt, isDone = false) {
  return {
    id,
    user_id: "user",
    title: id,
    notes: null,
    due_at: dueAt,
    is_done: isDone,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };
}

test("Today keeps overdue unfinished tasks visible", () => {
  const today = new Date(2026, 8, 19, 10, 0, 0);
  const rows = filterTasksForToday(
    [
      task("overdue", "2026-09-18T09:00:00"),
      task("today", "2026-09-19T18:00:00"),
      task("future", "2026-09-20T09:00:00"),
      task("flexible", null),
      task("done-overdue", "2026-09-18T09:00:00", true),
    ],
    today,
  );

  assert.deepEqual(
    rows.map((row) => row.id),
    ["overdue", "today", "flexible"],
  );
});

test("local date keys do not depend on UTC midnight", () => {
  assert.equal(getLocalDateKey(new Date(2026, 8, 19, 0, 5)), "2026-09-19");
});

test("weekly routines use ISO Monday-through-Sunday numbering", () => {
  const monday = new Date(2026, 8, 21, 12);
  const sunday = new Date(2026, 8, 20, 12);
  const routine = {
    id: "weekly",
    user_id: "user",
    title: "Weekly",
    frequency: "weekly",
    days_of_week: [1],
    preferred_time: null,
    is_active: true,
    created_at: "",
    updated_at: "",
  };

  assert.equal(routineOccursOn(routine, monday), true);
  assert.equal(routineOccursOn(routine, sunday), false);
});
