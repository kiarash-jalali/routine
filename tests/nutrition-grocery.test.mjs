import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

// Grocery generation (docs/nutrition-roadmap.md S4 acceptance): scaling by cook
// servings, staples on/off, count display, merge keeps flags and manual items.

const food = loadTypeScriptModule(new URL("../src/lib/nutrition/food.ts", import.meta.url));
const recipe = loadTypeScriptModule(new URL("../src/lib/nutrition/recipe.ts", import.meta.url), {
  "./food": food,
});
const grocery = loadTypeScriptModule(new URL("../src/lib/nutrition/grocery.ts", import.meta.url));
const plan = loadTypeScriptModule(new URL("../src/lib/nutrition/plan.ts", import.meta.url), {
  "./food": food,
  "./recipe": recipe,
});

const foods = new Map(
  [
    { id: "chicken", name_en: "Chicken", name_fa: "مرغ", grocery_section: "poultry", is_staple: false, count_unit_grams: null, serving_grams: null },
    { id: "rice", name_en: "Rice", name_fa: "برنج", grocery_section: "grains_legumes", is_staple: true, count_unit_grams: null, serving_grams: null },
    { id: "onion", name_en: "Onion", name_fa: "پیاز", grocery_section: "produce", is_staple: false, count_unit_grams: null, serving_grams: null },
    { id: "egg", name_en: "Egg", name_fa: "تخم‌مرغ", grocery_section: "dairy_eggs", is_staple: false, count_unit_grams: 50, serving_grams: 50 },
    { id: "yogurt", name_en: "Yogurt", name_fa: "ماست", grocery_section: null, is_staple: false, count_unit_grams: null, serving_grams: 150 },
  ].map((item) => [item.id, item]),
);
const recipes = new Map([
  [
    "polo",
    {
      id: "polo",
      servings: 4,
      ingredients: [
        { food_id: "chicken", grams: 600, is_staple: false, name_en: null, name_fa: null },
        { food_id: "rice", grams: 400, is_staple: false, name_en: null, name_fa: null },
        { food_id: "onion", grams: 150, is_staple: false, name_en: null, name_fa: null },
        { food_id: null, grams: 2, is_staple: true, name_en: "Saffron", name_fa: "زعفران" },
      ],
    },
  ],
  [
    "omelette",
    {
      id: "omelette",
      servings: 1,
      ingredients: [
        { food_id: "egg", grams: 110, is_staple: false, name_en: null, name_fa: null },
        { food_id: "onion", grams: 60, is_staple: false, name_en: null, name_fa: null },
      ],
    },
  ],
]);

const byFood = (items) => Object.fromEntries(items.map((item) => [item.food_id ?? item.name_en, item]));

test("recipe ingredients scale by cook servings / recipe servings", () => {
  const items = grocery.generateGroceries(
    [
      { recipe_id: "polo", food_id: null, cook_servings: 6, eaten_portions: 1 },
      { recipe_id: "polo", food_id: null, cook_servings: null, eaten_portions: 2 },
    ],
    recipes,
    foods,
    false,
  );
  const map = byFood(items);
  // 600 × 6/4 + 600 × 4/4 (null cook servings = the recipe's servings)
  assert.equal(map.chicken.grams, 1500);
  assert.equal(map.onion.grams, 375);
  // eaten portions do not change what is cooked
  assert.equal(map.chicken.count, null);
});

test("food entries add serving grams × eaten portions, default 100 g", () => {
  const items = grocery.generateGroceries(
    [
      { recipe_id: null, food_id: "yogurt", cook_servings: null, eaten_portions: 2 },
      { recipe_id: null, food_id: "onion", cook_servings: null, eaten_portions: 1.5 },
    ],
    recipes,
    foods,
    false,
  );
  const map = byFood(items);
  assert.equal(map.yogurt.grams, 300);
  assert.equal(map.yogurt.grocery_section, "other");
  assert.equal(map.onion.grams, 150);
});

test("staples are dropped unless turned on; food-less lines go to Staples to check", () => {
  const entries = [{ recipe_id: "polo", food_id: null, cook_servings: 4, eaten_portions: 1 }];
  const off = byFood(grocery.generateGroceries(entries, recipes, foods, false));
  assert.equal(off.rice, undefined);
  assert.equal(off.Saffron, undefined);

  const onItems = grocery.generateGroceries([...entries, ...entries], recipes, foods, true);
  const on = byFood(onItems);
  assert.equal(on.rice.grams, 800);
  assert.equal(on.Saffron.grocery_section, "staples");
  assert.equal(on.Saffron.grams, null);
  // listed once even when two entries use it, and last in section order
  assert.equal(onItems.filter((item) => item.name_en === "Saffron").length, 1);
  assert.equal(onItems.at(-1).name_en, "Saffron");
});

test("sections follow the seed order", () => {
  const items = grocery.generateGroceries(
    [
      { recipe_id: "polo", food_id: null, cook_servings: 4, eaten_portions: 1 },
      { recipe_id: "omelette", food_id: null, cook_servings: 1, eaten_portions: 1 },
    ],
    recipes,
    foods,
    false,
  );
  assert.deepEqual(
    items.map((item) => item.grocery_section),
    ["produce", "poultry", "dairy_eggs"],
  );
});

test("countable foods round up to a count; others show kg or 50 g steps", () => {
  const [egg] = grocery
    .generateGroceries(
      [{ recipe_id: "omelette", food_id: null, cook_servings: 3, eaten_portions: 1 }],
      recipes,
      foods,
      false,
    )
    .filter((item) => item.food_id === "egg");
  assert.equal(egg.grams, 330);
  assert.equal(egg.count, 7); // 330 / 50 = 6.6 → 7 eggs
  assert.deepEqual(grocery.groceryAmount(egg), { unit: "count", value: 7 });

  assert.deepEqual(grocery.groceryAmount({ grams: 1500, count: null }), { unit: "kg", value: 1.5 });
  assert.deepEqual(grocery.groceryAmount({ grams: 1000, count: null }), { unit: "kg", value: 1 });
  assert.deepEqual(grocery.groceryAmount({ grams: 375, count: null }), { unit: "g", value: 400 });
  assert.deepEqual(grocery.groceryAmount({ grams: 320, count: null }), { unit: "g", value: 300 });
  assert.deepEqual(grocery.groceryAmount({ grams: 8, count: null }), { unit: "g", value: 50 });
  assert.equal(grocery.groceryAmount({ grams: null, count: null }), null);
});

test("merge keeps ids and flags by food, keeps manual items, drops vanished unless bought", () => {
  const saved = [
    { id: "s1", food_id: "chicken", name_en: "Chicken", name_fa: "مرغ", grams: 600, count: null, grocery_section: "poultry", have: true, bought: false, is_manual: false },
    { id: "s2", food_id: "onion", name_en: "Onion", name_fa: "پیاز", grams: 150, count: null, grocery_section: "produce", have: false, bought: false, is_manual: false },
    { id: "s3", food_id: "egg", name_en: "Egg", name_fa: "تخم‌مرغ", grams: 110, count: 3, grocery_section: "dairy_eggs", have: false, bought: true, is_manual: false },
    { id: "s4", food_id: null, name_en: "Dish soap", name_fa: null, grams: null, count: null, grocery_section: "other", have: false, bought: false, is_manual: true },
  ];
  const generated = grocery.generateGroceries(
    [{ recipe_id: "polo", food_id: null, cook_servings: 8, eaten_portions: 1 }],
    recipes,
    foods,
    false,
  );
  const merged = grocery.mergeGroceries(saved, generated);
  const map = byFood(merged);

  assert.equal(map.chicken.id, "s1");
  assert.equal(map.chicken.have, true);
  assert.equal(map.chicken.grams, 1200); // amounts follow the new plan
  assert.equal(map.onion.id, "s2");
  assert.equal(map.egg.id, "s3"); // no longer planned, but already bought
  assert.equal(map["Dish soap"].id, "s4");
  assert.equal(merged.at(-1).is_manual, true);

  const unbought = grocery.mergeGroceries(
    saved.map((item) => (item.id === "s3" ? { ...item, bought: false } : item)),
    generated,
  );
  assert.equal(byFood(unbought).egg, undefined);
});

test("merge matches staples by name and new items have no id", () => {
  const generated = grocery.generateGroceries(
    [{ recipe_id: "polo", food_id: null, cook_servings: 4, eaten_portions: 1 }],
    recipes,
    foods,
    true,
  );
  const saved = [
    { id: "x", food_id: null, name_en: "Saffron", name_fa: "زعفران", grams: null, count: null, grocery_section: "staples", have: true, bought: false, is_manual: false },
  ];
  const merged = byFood(grocery.mergeGroceries(saved, generated));
  assert.equal(merged.Saffron.id, "x");
  assert.equal(merged.Saffron.have, true);
  assert.equal(merged.rice.id, null);
});

test("an unchanged regenerated list is not written again", () => {
  const generated = grocery.generateGroceries(
    [{ recipe_id: "omelette", food_id: null, cook_servings: 1, eaten_portions: 1 }],
    recipes,
    foods,
    false,
  );
  const first = grocery.mergeGroceries([], generated);
  assert.equal(grocery.groceriesChanged([], first), true);
  const saved = first.map((item, index) => ({ ...item, id: `id${index}` }));
  const again = grocery.mergeGroceries(saved, generated);
  assert.equal(grocery.groceriesChanged(saved, again), false);
  // ticking does not count as a change to write
  const ticked = saved.map((item) => ({ ...item, have: true }));
  assert.equal(grocery.groceriesChanged(ticked, grocery.mergeGroceries(ticked, generated)), false);
});

test("plan helpers: weeks, nutrition, copy last week", () => {
  assert.equal(plan.startOfWeek("2026-11-22", 6), "2026-11-21"); // Sunday → Saturday start
  assert.equal(plan.startOfWeek("2026-11-22", 1), "2026-11-16");
  assert.equal(plan.resolveWeekStart("next", "2026-11-22", 6), "2026-11-28");
  assert.equal(plan.resolveWeekStart("2026-12-02", "2026-11-22", 6), "2026-11-28");
  assert.equal(plan.resolveWeekStart("nonsense", "2026-11-22", 6), "2026-11-21");
  assert.deepEqual(plan.weekDays("2026-11-28").at(-1), "2026-12-04");
  assert.equal(plan.clampPortions(0.1), 0.25);
  assert.equal(plan.clampPortions(1.6), 1.5);

  const recipeMap = new Map([
    ["r", { servings: 2, ingredients: [{ grams: 200, food: { kcal: 100, protein: 10, fat: 0, carbs: 0 } }] }],
  ]);
  const foodMap = new Map([["f", { per100: { kcal: 50, protein: 5, fat: 0, carbs: 0 }, serving_grams: 200 }]]);
  const entries = [
    { plan_date: "2026-11-21", slot: "lunch", position: 0, recipe_id: "r", food_id: null, cook_servings: 2, eaten_portions: 1.5 },
    { plan_date: "2026-11-21", slot: "snack", position: 0, recipe_id: null, food_id: "f", cook_servings: null, eaten_portions: 1 },
    { plan_date: "2026-11-23", slot: "lunch", position: 0, recipe_id: null, food_id: "f", cook_servings: null, eaten_portions: 2 },
  ];
  assert.equal(plan.dayTotals(entries, "2026-11-21", recipeMap, foodMap).kcal, 150 + 100);
  assert.equal(plan.weekAverage(entries, "2026-11-21", recipeMap, foodMap).kcal, (250 + 200) / 2);
  assert.equal(plan.weekAverage([], "2026-11-21", recipeMap, foodMap), null);

  const current = [
    { plan_date: "2026-11-28", slot: "lunch", position: 0, recipe_id: null, food_id: "f", cook_servings: null, eaten_portions: 1 },
  ];
  const copied = plan.copyWeekEntries(entries, "2026-11-21", current);
  assert.equal(copied.length, 3);
  assert.deepEqual(
    copied.map((entry) => [entry.plan_date, entry.slot, entry.position]),
    [
      ["2026-11-28", "lunch", 1],
      ["2026-11-28", "snack", 0],
      ["2026-11-30", "lunch", 0],
    ],
  );
  assert.equal(copied[0].cook_servings, 2);
});
