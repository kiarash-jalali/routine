import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

// Runs the real useFoodToday hook on a tiny hook runtime with a fake database.
const load = (path, mocks) => loadTypeScriptModule(new URL(`../src/${path}`, import.meta.url), mocks);
const food = load("lib/nutrition/food.ts");
const body = load("lib/nutrition/body.ts");
const recipe = load("lib/nutrition/recipe.ts", { "./food": food });
const plan = load("lib/nutrition/plan.ts", { "./food": food, "./recipe": recipe });
const log = load("lib/nutrition/log.ts", { "./food": food, "./body": body });

const DAY = "2026-11-25";
const planned = {
  id: "p1", slot: "lunch", recipe_id: "r1", food_id: null, portions: 1,
  perPortion: { kcal: 310, protein: 35.7, fat: 4.6, carbs: 28, fiber: 1 },
  name_en: "Chicken rice", name_fa: "مرغ و برنج",
};

function setup({ rows = [], failInsert = null, gate = null, meals = [planned], profile = null } = {}) {
  const db = { rows, meals, inserts: 0, failInsert, nextId: 1 };
  const day = () => ({
    day: DAY, profile, weighIns: [], adjustments: [], week: [],
    entries: db.rows.map((r) => ({ ...r })), recent: db.rows.map((r) => ({ ...r })),
  });
  const foodLog = {
    loadFoodDay: async () => {
      if (db.refresh) await db.refresh();
      return day();
    },
    addLogEntry: async (userId, eaten_on, draft) => {
      db.inserts++;
      if (gate) await gate;
      if (db.failInsert) throw new Error(db.failInsert);
      // Same rule as food_log_entries_plan_day_key.
      if (draft.meal_plan_entry_id && db.rows.some((r) => r.meal_plan_entry_id === draft.meal_plan_entry_id))
        throw new Error("food_log_already_logged");
      const id = `l${db.nextId++}`;
      db.rows.push({ id, eaten_on, ...draft });
      return id;
    },
    deleteLogEntry: async (userId, id) => {
      db.rows = db.rows.filter((r) => r.id !== id);
    },
  };
  const mealPlan = { loadPlannedMeals: async () => ({ day: DAY, meals: db.meals }) };

  const cells = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in cells)) cells[i] = initial;
      return [cells[i], (next) => { cells[i] = typeof next === "function" ? next(cells[i]) : next; }];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in cells)) cells[i] = { current: initial };
      return cells[i];
    },
    useEffect() {},
  };
  const { useFoodToday: runHook } = load("components/today/useFoodToday.ts", {
    react,
    "@/lib/db/foodLog": foodLog,
    "@/lib/db/mealPlan": mealPlan,
    "@/lib/nutrition/log": log,
  });
  const initial = day();
  const initialPlan = { day: DAY, meals: [...meals] };
  const render = () => {
    cursor = 0;
    return runHook("u1", DAY, initial, initialPlan, DAY);
  };
  return { db, render };
}

test("one tap logs the planned meal with its snapshot", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { db, render } = setup();
  const before = render();
  assert.equal(before.visible, true, "a planned meal shows the card without a body profile");
  assert.equal(before.planned[0].logged, null);

  assert.equal(await before.logPlanned(planned, 1, "Chicken rice"), true);
  assert.deepEqual(db.rows, [{
    id: "l1", eaten_on: DAY, slot: "lunch", source: "plan", food_id: null, recipe_id: "r1",
    meal_plan_entry_id: "p1", portions: 1, grams: null, label: "Chicken rice",
    kcal: 310, protein: 35.7, fat: 4.6, carbs: 28,
  }]);
  const after = render();
  assert.equal(after.planned[0].logged.id, "l1");
  assert.equal(after.totals.kcal, 310);
  assert.deepEqual(after.undo, { id: "l1", label: "Chicken rice" });
});

test("adjusted portions are what gets logged", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { db, render } = setup();
  await render().logPlanned(planned, 1.5, "Chicken rice");
  assert.equal(db.rows[0].portions, 1.5);
  assert.equal(db.rows[0].kcal, 465);
  assert.equal(db.rows[0].protein, 53.6);
});

test("undo removes the log and the meal can be logged again", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { db, render } = setup();
  await render().logPlanned(planned, 1, "Chicken rice");
  await render().undoLast();
  assert.equal(db.rows.length, 0);
  const undone = render();
  assert.equal(undone.planned[0].logged, null);
  assert.equal(undone.undo, null);
  assert.equal(await undone.logPlanned(planned, 2, "Chicken rice"), true);
  assert.equal(db.rows.length, 1);
});

test("undo is offered for exactly 5 seconds and the log stays", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { db, render } = setup();
  await render().logPlanned(planned, 1, "Chicken rice");
  t.mock.timers.tick(4999);
  assert.notEqual(render().undo, null);
  t.mock.timers.tick(1);
  assert.equal(render().undo, null);
  assert.equal(db.rows.length, 1);
});

test("the 5 seconds start when the refresh ends, not while Undo is disabled", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { db, render } = setup();
  let finish;
  const started = new Promise((begin) => {
    db.refresh = () => {
      begin();
      return new Promise((resolve) => { finish = resolve; });
    };
  });
  const saving = render().logPlanned(planned, 1, "Chicken rice");
  await started;
  t.mock.timers.tick(5000);
  finish();
  await saving;
  assert.notEqual(render().undo, null);
  t.mock.timers.tick(5000);
  assert.equal(render().undo, null);
});

test("a failed refresh still shows the log, and its undo", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { db, render } = setup();
  db.refresh = async () => { throw new Error("offline"); };
  assert.equal(await render().logPlanned(planned, 1, "Chicken rice"), true);
  assert.equal(render().planned[0].logged.id, "l1");
  assert.equal(render().totals.kcal, 310);
  await render().undoLast();
  assert.equal(render().planned[0].logged, null);
  assert.equal(render().totals.kcal, 0);
  assert.equal(render().failed, false);
});

test("a double tap writes once", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let open;
  const { db, render } = setup({ gate: new Promise((resolve) => { open = resolve; }) });
  const state = render();
  const first = state.logPlanned(planned, 1, "Chicken rice");
  const second = state.logPlanned(planned, 1, "Chicken rice");
  open();
  assert.deepEqual(await Promise.all([first, second]), [true, false]);
  assert.equal(db.inserts, 1);
});

test("a meal already logged on another device refreshes without an error", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { db, render } = setup();
  const state = render();
  db.rows.push({ id: "other", eaten_on: DAY, ...log.entryFromPlan(planned, 1, "Chicken rice") });
  assert.equal(await state.logPlanned(planned, 1, "Chicken rice"), false);
  const after = render();
  assert.equal(after.failed, false);
  assert.equal(after.planned[0].logged.id, "other");
  assert.equal(after.undo, null, "undo must not delete the other device's entry");
});

test("a plan entry removed elsewhere shows an error and leaves the list", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { db, render } = setup({ failInsert: "food_log_save_failed" });
  const state = render();
  db.meals = [];
  assert.equal(await state.logPlanned(planned, 1, "Chicken rice"), false);
  const after = render();
  assert.equal(after.failed, true);
  assert.equal(after.planned.length, 0);
  assert.equal(after.busy, false);
});

test("loadPlannedMeals scopes to the user and day, orders by slot and computes one portion", async () => {
  const per100 = { kcal_100g: "120", protein_100g: 22, fat_100g: 3, carbs_100g: 0, fiber_100g: 0 };
  const rows = [
    {
      id: "p2", slot: "dinner", position: 0, recipe_id: "r1", food_id: null, eaten_portions: "1.5", food: null,
      recipe: { title_en: "Stew", title_fa: "خورش", servings: 2, ingredients: [{ grams: "300", food: per100 }, { grams: 5, food: null }] },
    },
    {
      id: "p1", slot: "breakfast", position: 1, recipe_id: null, food_id: "f1", eaten_portions: 1, recipe: null,
      food: { name_en: "Egg", name_fa: "تخم‌مرغ", serving_grams: 50, ...per100 },
    },
    { id: "gone", slot: "lunch", position: 0, recipe_id: "hidden", food_id: null, eaten_portions: 1, recipe: null, food: null },
  ];
  const calls = [];
  const query = new Proxy({}, {
    get: (_, name) =>
      name === "then"
        ? (resolve) => resolve({ data: rows, error: null })
        : (...args) => { calls.push([name, ...args]); return query; },
  });
  const { loadPlannedMeals } = load("lib/db/mealPlan.ts", {
    "@/lib/supabaseClient": {},
    "@/lib/nutrition/body": body,
    "@/lib/nutrition/log": log,
    "@/lib/nutrition/grocery": {},
    "@/lib/nutrition/plan": plan,
  });
  const result = await loadPlannedMeals("u1", DAY, query);
  assert.ok(calls.some((c) => c[0] === "eq" && c[1] === "user_id" && c[2] === "u1"));
  assert.ok(calls.some((c) => c[0] === "eq" && c[1] === "plan_date" && c[2] === DAY));
  assert.deepEqual(result.meals.map((m) => [m.id, m.portions, m.perPortion.kcal, m.name_en]), [
    ["p1", 1, 60, "Egg"],
    ["p2", 1.5, 180, "Stew"],
  ]);
});
