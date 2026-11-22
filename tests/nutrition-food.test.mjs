import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

const nutrition = loadTypeScriptModule(
  new URL("../src/lib/nutrition/food.ts", import.meta.url),
);
const json = (path) =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const catalog = json("supabase/seed/food-catalog.json");
const recipes = json("supabase/seed/starter-recipes.json").recipes;
const foods = new Map(
  [...catalog.ingredients, ...catalog.dishes].map((food) => [food.slug, food]),
);

function perPortionInclSide(recipe) {
  let value = nutrition.recipePerServing(
    recipe.ingredients.map((item) => ({
      food: item.food_slug ? foods.get(item.food_slug).per_100g : null,
      grams: item.grams,
    })),
    recipe.servings,
  );
  if (recipe.suggested_side) {
    value = nutrition.addNutrition(
      value,
      nutrition.foodNutrition(
        foods.get(recipe.suggested_side.food_slug).per_100g,
        recipe.suggested_side.grams,
      ),
    );
  }
  return value;
}

test("food nutrition scales per-100 g values by grams", () => {
  const value = nutrition.foodNutrition(
    { kcal: 120, protein: 22.5, fat: 2.6, carbs: 0, fiber: 0 },
    150,
  );
  assert.equal(value.kcal, 180);
  assert.equal(Math.round(value.protein * 100) / 100, 33.75);
  assert.deepEqual(
    nutrition.roundForStorage({ kcal: 180.4, protein: 33.75, fat: 3.9, carbs: 0, fiber: 0 }),
    { kcal: 180, protein: 33.8, fat: 3.9, carbs: 0, fiber: 0 },
  );
});

test("ingredients without a food contribute nothing", () => {
  const value = nutrition.recipePerServing(
    [
      { food: { kcal: 100, protein: 10, fat: 0, carbs: 15 }, grams: 200 },
      { food: null, grams: 5 },
    ],
    2,
  );
  assert.equal(value.kcal, 100);
  assert.equal(value.protein, 10);
});

test("seed catalog has 353 foods and every recipe slug resolves", () => {
  assert.equal(catalog.ingredients.length, 53);
  assert.equal(catalog.dishes.length, 300);
  assert.equal(recipes.length, 40);
  for (const recipe of recipes) {
    for (const item of recipe.ingredients) {
      if (item.food_slug) assert.ok(foods.has(item.food_slug), item.food_slug);
      else assert.ok(item.is_staple && item.name_en, `${recipe.slug} staple`);
    }
    if (recipe.suggested_side) assert.ok(foods.has(recipe.suggested_side.food_slug));
    assert.equal(recipe.steps_en.length, recipe.steps_fa.length, recipe.slug);
    assert.ok(recipe.tip_en, `${recipe.slug} tip_en`);
  }
});

// The seed's side text can name two foods ("bread + yogurt") while
// suggested_side (and the schema) holds only the first, so those totals differ.
const singleSide = (recipe) => !recipe.suggested_side?.text_fa.includes("+");

test("recomputed per-serving nutrition matches the seed within 2%", () => {
  const checked = recipes.filter(singleSide);
  assert.ok(checked.length >= 5);
  const off = checked
    .map((recipe) => {
      const value = perPortionInclSide(recipe);
      const expected = recipe.per_portion_incl_side;
      return {
        slug: recipe.slug,
        kcal: Math.abs(value.kcal - expected.kcal) / expected.kcal,
        // Seed protein is rounded to whole grams.
        protein: Math.abs(value.protein - expected.protein),
      };
    })
    .filter((row) => row.kcal > 0.02 || row.protein > 1); // protein: within 1 g
  assert.deepEqual(off, []);
});

test("multi-food sides are the only recipes whose seed totals include extra food", () => {
  const multi = recipes.filter((recipe) => !singleSide(recipe)).map((r) => r.slug);
  assert.deepEqual(multi.sort(), ["starter-n04", "starter-n10", "starter-n11"].sort());
});

test("committed seed migrations match the generator output", async () => {
  const { readdirSync } = await import("node:fs");
  const { buildSeedParts } = await import("../scripts/generate-food-seed.mjs");
  const files = readdirSync(new URL("../supabase/migrations/", import.meta.url)).sort();
  const parts = buildSeedParts(catalog, json("supabase/seed/starter-recipes.json"));
  // Parts corrected after they were applied, by a later targeted migration.
  const fixedLater = {
    seed_food_catalog_recipes: "remove_personal_name_from_starter_recipes",
  };
  let previous = "";
  for (const part of parts) {
    const matches = files.filter((name) => name.endsWith(`_${part.name}.sql`));
    assert.ok(matches.length >= 1, `missing ${part.name}; run node scripts/generate-food-seed.mjs`);
    const latest = matches.at(-1);
    assert.ok(latest > previous, `${part.name} must sort after the previous part`);
    previous = latest;
    const committed = readFileSync(
      new URL(`../supabase/migrations/${latest}`, import.meta.url),
      "utf8",
    ).replace(/\r\n/g, "\n"); // Windows checkouts (core.autocrlf) use CRLF
    const fix = fixedLater[part.name];
    if (fix) {
      assert.ok(files.some((name) => name > latest && name.endsWith(`_${fix}.sql`)), `missing ${fix}`);
      continue;
    }
    assert.equal(committed, part.sql, `${latest} is out of date`);
  }
  assert.match(parts[0].sql, /on conflict \(slug\) do update/);
});

test("shared seed data contains no personal names", () => {
  for (const path of ["supabase/seed/food-catalog.json", "supabase/seed/starter-recipes.json"]) {
    const text = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(text, /کیارش|kiarash/i, path);
  }
});
