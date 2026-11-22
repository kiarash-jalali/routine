import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

const workouts = loadTypeScriptModule(
  new URL("../src/lib/workouts/structured.ts", import.meta.url),
);
const plain = (value) => JSON.parse(JSON.stringify(value));

test("parses sets x reps, pyramids and each-side schemes", () => {
  assert.deepEqual(plain(workouts.parseRepScheme("3x10")), {
    sets: 3, reps: [10, 10, 10], minReps: [10, 10, 10], eachSide: false,
  });
  assert.deepEqual(plain(workouts.parseRepScheme("15/12/10")), {
    sets: 3, reps: [15, 12, 10], minReps: [15, 12, 10], eachSide: false,
  });
  assert.deepEqual(plain(workouts.parseRepScheme("3 × 12 each leg")), {
    sets: 3, reps: [12, 12, 12], minReps: [12, 12, 12], eachSide: true,
  });
  assert.deepEqual(plain(workouts.parseRepScheme("4x8-12")).reps, [12, 12, 12, 12]);
  assert.deepEqual(plain(workouts.parseRepScheme("۳x۱۰")).reps, [10, 10, 10]);
  assert.equal(workouts.parseRepScheme("walk 20 minutes"), null);
  assert.equal(workouts.parseRepScheme("0x10"), null);
  assert.equal(workouts.parseRepScheme(""), null);
});

test("converts free-text exercise lines and flags lines to fix", () => {
  const rows = plain(
    workouts.parseExerciseLines(
      "Squat — 3x10\n- Lunges: 3 × 12 each leg\n1. Push-ups 15/12/10\nStretch for a while\n\n",
    ),
  );
  assert.deepEqual(rows, [
    { name: "Squat", target_sets: 3, rep_scheme: "3x10", parsed: true },
    { name: "Lunges", target_sets: 3, rep_scheme: "3 × 12 each leg", parsed: true },
    { name: "Push-ups", target_sets: 3, rep_scheme: "15/12/10", parsed: true },
    { name: "Stretch for a while", target_sets: 3, rep_scheme: "", parsed: false },
  ]);
});

test("progression hint needs every set at the top of the scheme", () => {
  const full = [
    { set_number: 1, reps: 12 },
    { set_number: 2, reps: 12 },
    { set_number: 3, reps: 12 },
  ];
  assert.equal(workouts.readyToProgress("3x8-12", full), true);
  assert.equal(workouts.readyToProgress("3x8-12", full.slice(0, 2)), false);
  assert.equal(
    workouts.readyToProgress("3x8-12", [...full.slice(0, 2), { set_number: 3, reps: 10 }]),
    false,
  );
  assert.equal(
    workouts.readyToProgress("15/12/10", [
      { set_number: 1, reps: 15 },
      { set_number: 2, reps: 12 },
      { set_number: 3, reps: 11 },
    ]),
    true,
  );
  assert.equal(workouts.readyToProgress("", full), false);
  assert.equal(workouts.targetRepsFor("15/12/10", 2), 12);
});

test("schemes do not swallow trailing digits and the last scheme on a line wins", () => {
  const { parseRepScheme, parseExerciseLines } = workouts;
  assert.equal(parseRepScheme("3x10-1000"), null);
  assert.equal(parseRepScheme("15/12/1000"), null);
  assert.deepEqual(plain(parseRepScheme("3x10 each leg"))?.reps, [10, 10, 10]);

  const [kneeling, leading, pyramid, persian] = plain(parseExerciseLines(
    "Half-kneeling 1/2 press 3x10\n3x12 Squats\nLunge — 15/12/10\nاسکات ۳×۱۰",
  ));
  assert.deepEqual(kneeling, { name: "Half-kneeling 1/2 press", target_sets: 3, rep_scheme: "3x10", parsed: true });
  assert.deepEqual(leading, { name: "Squats", target_sets: 3, rep_scheme: "3x12", parsed: true });
  assert.deepEqual(pyramid, { name: "Lunge", target_sets: 3, rep_scheme: "15/12/10", parsed: true });
  assert.equal(persian?.name, "اسکات");
  assert.equal(persian?.parsed, true);
});

test("exercise saves are one RPC and archived exercises keep their set history", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../src/lib/db/workoutExercises.ts", import.meta.url), "utf8");
  const migration = await readFile(
    new URL("../supabase/migrations/20261122120000_nutrition_review_fixes.sql", import.meta.url),
    "utf8",
  );
  assert.match(source, /rpc\("save_plan_exercises"/);
  assert.doesNotMatch(source, /from\("workout_plan_exercises"\)\s*\.delete\(\)/);
  assert.match(source, /archived_at/);
  assert.match(migration, /before delete on public\.workout_plans/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /not exists \(select 1 from public\.workout_set_logs l where l\.session_id = s\.id\)/);
  assert.doesNotMatch(migration, /references public\.workout_plan_exercises\(id, user_id\)\s+on delete cascade/);
});
