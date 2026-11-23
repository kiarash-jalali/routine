import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

const food = loadTypeScriptModule(new URL("../src/lib/nutrition/food.ts", import.meta.url));
const body = loadTypeScriptModule(new URL("../src/lib/nutrition/body.ts", import.meta.url));
const recipe = loadTypeScriptModule(new URL("../src/lib/nutrition/recipe.ts", import.meta.url), {
  "./food": food,
});
const log = loadTypeScriptModule(new URL("../src/lib/nutrition/log.ts", import.meta.url), {
  "./food": food,
  "./body": body,
});

const chicken = { kcal: 120, protein: 22, fat: 3, carbs: 0, fiber: 0 };
const rice = { kcal: 130, protein: 2.7, fat: 0.3, carbs: 28, fiber: 0.4 };

test("a logged recipe is a snapshot: editing the recipe later never changes it", () => {
  const ingredients = [
    { grams: 300, food: { ...chicken } },
    { grams: 200, food: { ...rice } },
  ];
  const before = recipe.perServing(ingredients, 2);
  const entry = log.entryFromRecipe({ id: "r1", perServing: before }, 1, "  Chicken rice ", "lunch");
  const stored = structuredClone(entry);

  // The user later edits the recipe: more chicken, other rice, more servings.
  ingredients[0].grams = 600;
  ingredients[1].food.kcal = 360;
  const after = recipe.perServing(ingredients, 3);

  assert.notEqual(Math.round(after.kcal), entry.kcal, "fixture must actually change");
  assert.deepEqual(entry, stored);
  // (300·1.2 + 200·1.3) / 2 = 310 kcal; (66 + 5.4) / 2 = 35.7 g protein.
  assert.equal(entry.kcal, 310);
  assert.equal(entry.protein, 35.7);
  assert.equal(entry.label, "Chicken rice");
  assert.equal(entry.source, "recipe");
  assert.equal(entry.recipe_id, "r1");
});

test("food, recipe and quick entries round for storage", () => {
  const f = log.entryFromFood({ id: "f1", per100: rice }, 150, "Rice", "dinner");
  assert.deepEqual(
    { kcal: f.kcal, protein: f.protein, fat: f.fat, carbs: f.carbs, grams: f.grams, portions: f.portions },
    { kcal: 195, protein: 4.1, fat: 0.5, carbs: 42, grams: 150, portions: null },
  );
  const half = log.entryFromRecipe({ id: "r", perServing: { kcal: 501, protein: 30.33, fat: 10, carbs: 50, fiber: 2 } }, 1.5, "Stew", "dinner");
  assert.equal(half.kcal, 752);
  assert.equal(half.protein, 45.5);
  const quick = log.entryFromQuick({ label: "Cake", kcal: 350.4, protein: null }, "snack");
  assert.deepEqual(
    { kcal: quick.kcal, protein: quick.protein, food_id: quick.food_id, recipe_id: quick.recipe_id, source: quick.source },
    { kcal: 350, protein: 0, food_id: null, recipe_id: null, source: "quick" },
  );
});

test("editing the amount rescales the stored snapshot", () => {
  const entry = { portions: 1, grams: null, kcal: 400, protein: 20, fat: 10, carbs: 50 };
  assert.deepEqual(log.rescaleEntry(entry, { portions: 2 }), {
    portions: 2, grams: null, kcal: 800, protein: 40, fat: 20, carbs: 100,
  });
  const grams = { portions: null, grams: 200, kcal: 300, protein: 9, fat: 3, carbs: 60 };
  assert.deepEqual(log.rescaleEntry(grams, { grams: 50 }), {
    portions: null, grams: 50, kcal: 75, protein: 2.3, fat: 0.8, carbs: 15,
  });
  // Quick entries have no amount: unchanged.
  const quick = { portions: null, grams: null, kcal: 300, protein: 0, fat: 0, carbs: 0 };
  assert.deepEqual(log.rescaleEntry(quick, { portions: 2 }), quick);
});

test("totals match the sum of entries", () => {
  const entries = [
    { kcal: 310, protein: 35.7, fat: 4.6, carbs: 28 },
    { kcal: 195, protein: "4.1", fat: 0.5, carbs: 42 }, // numeric columns can arrive as strings
    { kcal: 350, protein: 0, fat: 0, carbs: 0 },
  ];
  assert.deepEqual(log.dayTotals(entries), { kcal: 855, protein: 39.8, fat: 5.1, carbs: 70 });
  assert.deepEqual(log.dayTotals([]), { kcal: 0, protein: 0, fat: 0, carbs: 0 });
});

test("7-day series fills missing days with zero, oldest first", () => {
  const series = log.dailySeries(
    [
      { eaten_on: "2026-11-22", kcal: 500, protein: 20 },
      { eaten_on: "2026-11-22", kcal: 300, protein: 10.5 },
      { eaten_on: "2026-11-18", kcal: 1800, protein: 60 },
      { eaten_on: "2026-11-10", kcal: 999, protein: 99 },
    ],
    "2026-11-22",
  );
  assert.equal(series.length, 7);
  assert.equal(series[0].day, "2026-11-16");
  assert.deepEqual(series[6], { day: "2026-11-22", kcal: 800, protein: 30.5 });
  assert.deepEqual(series[2], { day: "2026-11-18", kcal: 1800, protein: 60 });
  assert.equal(series[1].kcal, 0);
});

test("recent items are distinct by food, recipe or label", () => {
  const base = { slot: "lunch", portions: null, grams: null, protein: 0, fat: 0, carbs: 0 };
  const entries = [
    { ...base, source: "food", food_id: "f1", recipe_id: null, label: "Rice", kcal: 195 },
    { ...base, source: "recipe", food_id: null, recipe_id: "r1", label: "Stew", kcal: 500 },
    { ...base, source: "food", food_id: "f1", recipe_id: null, label: "Rice", kcal: 390 },
    { ...base, source: "quick", food_id: null, recipe_id: null, label: "Cake", kcal: 350 },
    { ...base, source: "quick", food_id: null, recipe_id: null, label: " cake", kcal: 350 },
    { ...base, source: "quick", food_id: null, recipe_id: null, label: "Cake", kcal: 200 },
  ];
  assert.deepEqual(
    log.recentItems(entries).map((e) => `${e.label}:${e.kcal}`),
    ["Rice:195", "Stew:500", "Cake:350", "Cake:200"],
  );
  assert.equal(log.recentItems(entries, 2).length, 2);
});

test("default slot follows the time of day", () => {
  assert.equal(log.defaultSlot(7), "breakfast");
  assert.equal(log.defaultSlot(13), "lunch");
  assert.equal(log.defaultSlot(16), "snack");
  assert.equal(log.defaultSlot(19), "dinner");
  assert.equal(log.defaultSlot(23), "snack");
});

const profile = {
  sex: "male", birth_year: 1986, height_cm: 180, activity_level: "moderate",
  goal_mode: "lose", goal_weight_kg: null, goal_rate_kg_week: 0.5,
  kcal_target_override: null, protein_mode: "auto", protein_grams: null,
};
const weighIns = [{ day: "2026-11-20", weightKg: 90 }];

test("targets come from section 4, with accepted adjustments", () => {
  assert.equal(log.dailyTargets(null, weighIns, [], "2026-11-22"), null);
  // Same fixture as the S2 tests: 2290 kcal, 95 g protein.
  const plain = log.dailyTargets(profile, weighIns, [], "2026-11-22");
  assert.equal(plain.energy.kcal, 2290);
  assert.equal(plain.protein.grams, 95);
  assert.equal(plain.adjustedBy, 0);

  const adjusted = log.dailyTargets(
    profile,
    weighIns,
    [
      { effective_from: "2026-11-15", delta_kcal: -150 },
      { effective_from: "2026-11-30", delta_kcal: -150 }, // not effective yet
    ],
    "2026-11-22",
  );
  assert.equal(adjusted.energy.kcal, 2140);
  assert.equal(adjusted.adjustedBy, -150);

  // Never below the floor (1500 kcal for men).
  const floored = log.dailyTargets(profile, weighIns, [{ effective_from: "2026-11-01", delta_kcal: -1000 }], "2026-11-22");
  assert.equal(floored.energy.kcal, 1500);
  assert.equal(floored.adjustedBy, -790);

  // Weigh-ins after the day are ignored; with none, there is no calculated target.
  assert.equal(log.dailyTargets(profile, weighIns, [], "2026-11-19").energy.kcal, null);
});

test("a target set by the user wins over adjustments; limit mode stays a limit", () => {
  const own = { ...profile, kcal_target_override: 1800, protein_mode: "limit", protein_grams: 60 };
  const targets = log.dailyTargets(own, weighIns, [{ effective_from: "2026-11-01", delta_kcal: -150 }], "2026-11-22");
  assert.equal(targets.energy.kcal, 1800);
  assert.equal(targets.energy.source, "user");
  assert.equal(targets.adjustedBy, 0);
  assert.deepEqual(targets.protein, { grams: 60, mode: "limit", source: "user" });
  assert.equal(body.proteinBarState(55, targets.protein), "amber");
  assert.equal(body.proteinBarState(50, targets.protein), "normal");
});

test("quick-calories validation mirrors the table", () => {
  assert.equal(log.validateQuick({ label: " ", kcal: 100, protein: null }), "label");
  assert.equal(log.validateQuick({ label: "x", kcal: Number.NaN, protein: null }), "kcal");
  assert.equal(log.validateQuick({ label: "x", kcal: 10001, protein: null }), "kcal");
  assert.equal(log.validateQuick({ label: "x", kcal: 100, protein: -1 }), "protein");
  assert.equal(log.validateQuick({ label: "x", kcal: 0, protein: 0 }), null);
});
