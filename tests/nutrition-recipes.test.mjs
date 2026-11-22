import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

const food = loadTypeScriptModule(new URL("../src/lib/nutrition/food.ts", import.meta.url));
const recipe = loadTypeScriptModule(new URL("../src/lib/nutrition/recipe.ts", import.meta.url), {
  "./food": food,
});
const search = loadTypeScriptModule(new URL("../src/lib/nutrition/search.ts", import.meta.url));
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const catalog = JSON.parse(source("supabase/seed/food-catalog.json"));
const starters = JSON.parse(source("supabase/seed/starter-recipes.json")).recipes;

const chicken = { kcal: 120, protein: 22, fat: 3, carbs: 0, fiber: 0 };
const rice = { kcal: 130, protein: 2.7, fat: 0.3, carbs: 28, fiber: 0.4 };
const ingredients = [
  { grams: 300, food: chicken },
  { grams: 200, food: rice },
  { grams: 5, food: null }, // salt to taste
];

test("servings stepper rescales grams and nutrition", () => {
  const factor = recipe.servingsFactor(2, 3);
  assert.equal(factor, 1.5);
  assert.equal(recipe.scaleGrams(300, factor), 450);
  assert.equal(recipe.scaleGrams(5, factor), 7.5);
  assert.equal(recipe.scaleGrams(3, 1 / 3), 1);

  const one = recipe.perServing(ingredients, 2);
  assert.equal(one.kcal, (360 + 260) / 2);
  const three = recipe.nutritionForServings(ingredients, 2, 3);
  assert.equal(three.kcal, one.kcal * 3);
  assert.equal(Math.round(three.protein * 10) / 10, Math.round(one.protein * 3 * 10) / 10);
  // Per-serving values do not depend on how many servings are being cooked.
  assert.deepEqual(recipe.perServing(ingredients, 2), one);
});

test("servings are clamped to the schema range", () => {
  assert.equal(recipe.clampServings(0), 1);
  assert.equal(recipe.clampServings(25), 20);
  assert.equal(recipe.clampServings(Number.NaN), 1);
  assert.equal(recipe.servingsFactor(4, 99), 5);
});

test("saving a starter recipe builds a user-owned copy payload", () => {
  const starter = {
    id: "11111111-1111-4111-8111-111111111111",
    owner_id: null,
    slug: "starter-b01",
    title_en: "Bread, feta, walnut & herbs",
    title_fa: "نان، پنیر، گردو و سبزی",
    category: "breakfast",
    servings: 1,
    steps_en: ["Toast the bread."],
    steps_fa: ["نان را گرم کن."],
    tip_en: null,
    tip_fa: "نکته",
    tags: ["quick"],
    suggested_side_food_id: null,
    suggested_side_grams: null,
  };
  const rows = [
    { id: "a", position: 1, food_id: null, name_en: "Salt", name_fa: null, grams: 0, amount_en: null, amount_fa: null, is_staple: true },
    { id: "b", position: 0, food_id: "f1", name_en: null, name_fa: "نان", grams: 80, amount_en: null, amount_fa: "80 گرم", is_staple: false },
  ];
  const copy = recipe.recipeCopyPayload(starter, rows);
  assert.equal(copy.recipe.copied_from, starter.id);
  for (const key of ["id", "owner_id", "slug"]) assert.ok(!(key in copy.recipe), key);
  assert.deepEqual(copy.ingredients.map((item) => item.food_id), ["f1", null]);
  assert.ok(copy.ingredients.every((item) => !("id" in item) && !("position" in item)));
  // The copy never shares arrays with the catalog row.
  copy.recipe.tags.push("batch");
  assert.deepEqual(starter.tags, ["quick"]);
});

test("search finds Persian and English names alike", () => {
  const dish = catalog.dishes.find((item) => item.name_en === "Ghormeh sabzi");
  assert.ok(dish);
  for (const query of ["قورمه", "ghormeh", "GHORMEH", "قورمه سبزی", "ghormeh سبزی"])
    assert.ok(search.matchesSearch(query, [dish.name_en, dish.name_fa]), query);
  const starter = starters.find((item) => item.title_en === "Light ghormeh sabzi");
  assert.ok(search.matchesSearch("قورمه", [starter.title_en, starter.title_fa]));
  assert.ok(search.matchesSearch("ghormeh", [starter.title_en, starter.title_fa]));
  assert.ok(!search.matchesSearch("kebab", [dish.name_en, dish.name_fa]));
});

test("search normalizes Arabic letter variants, marks and joiners", () => {
  assert.equal(search.normalizeSearch("كباب"), search.normalizeSearch("کباب"));
  assert.equal(search.normalizeSearch("پنير"), "پنیر");
  assert.ok(search.matchesSearch("میان وعده", ["میان‌وعده"]));
  assert.ok(search.matchesSearch("آش", ["اش رشته"]));
  assert.ok(search.matchesSearch("  ", ["anything"]));
  assert.ok(search.matchesSearch("rice", [null, "Rice pudding"]));
});

test("recipe draft validation mirrors the table checks", () => {
  const ok = { title_en: "Soup", title_fa: null, servings: 2, steps_en: [], steps_fa: [] };
  const item = { food_id: "f1", name_en: null, name_fa: null, grams: 100 };
  assert.equal(recipe.validateRecipeDraft(ok, [item]), null);
  assert.equal(recipe.validateRecipeDraft({ ...ok, title_en: "  " }, [item]), "title");
  assert.equal(recipe.validateRecipeDraft({ ...ok, title_en: null, title_fa: "سوپ" }, [item]), null);
  assert.equal(recipe.validateRecipeDraft({ ...ok, servings: 0 }, [item]), "servings");
  assert.equal(recipe.validateRecipeDraft({ ...ok, servings: 1.5 }, [item]), "servings");
  assert.equal(recipe.validateRecipeDraft(ok, [{ ...item, food_id: null }]), "ingredientName");
  assert.equal(recipe.validateRecipeDraft(ok, [{ ...item, grams: 6000 }]), "grams");
  assert.equal(recipe.validateRecipeDraft(ok, [{ ...item, grams: Number.NaN }]), "grams");
  assert.equal(recipe.validateRecipeDraft(ok, Array(61).fill(item)), "ingredients");
  assert.equal(recipe.validateRecipeDraft({ ...ok, steps_en: ["x".repeat(8001)] }, [item]), "steps");
  assert.equal(recipe.validateRecipeDraft({ ...ok, tags: Array(13).fill("quick") }, [item]), "tags");
});

test("grams typed with Persian digits parse; empty input is never 0 g", () => {
  assert.equal(recipe.parseAmount("۱۵۰"), 150);
  assert.equal(recipe.parseAmount("٢٫٥"), 2.5);
  assert.equal(recipe.parseAmount(" 80 "), 80);
  assert.ok(Number.isNaN(recipe.parseAmount("")));
  assert.ok(Number.isNaN(recipe.parseAmount("1e")));
  assert.equal(recipe.toLatinDigits("۱۲۳"), "123");
});

test("names fall back to the other language", () => {
  assert.equal(recipe.localizedName("fa", "Rice", "برنج"), "برنج");
  assert.equal(recipe.localizedName("fa", "Rice", null), "Rice");
  assert.equal(recipe.localizedName("en", null, "برنج"), "برنج");
  assert.equal(recipe.isRecipeId("11111111-1111-4111-8111-111111111111"), true);
  assert.equal(recipe.isRecipeId("starter-b01"), false);
});

test("food data layer selects explicit columns and only writes own rows", () => {
  const db = source("src/lib/db/food.ts");
  assert.doesNotMatch(db, /select\(\s*["'`]\*["'`]\s*\)/);
  // Every direct update/delete is scoped to the caller; recipe saves go through the RPC.
  const writes = db.match(/\.(update|delete)\([^)]*\)[^;]*;/gs) ?? [];
  assert.ok(writes.length >= 3);
  for (const write of writes) assert.match(write, /\.eq\("owner_id", userId\)/, write);
  assert.match(db, /\.rpc\("save_recipe"/);
  assert.doesNotMatch(db, /from\("recipe_ingredients"\)\s*\.(insert|update|delete)/);
});

test("save_recipe is security invoker and only updates the caller's recipes", () => {
  const sql = source("supabase/migrations/20261122150000_save_recipe_rpc.sql");
  assert.match(sql, /security invoker/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /where id = p_recipe_id and owner_id = v_user/);
  assert.match(sql, /revoke all on function public\.save_recipe\(uuid, jsonb, jsonb\) from public, anon/);
});

test("Food is a nav tab and /food is an authenticated app route", () => {
  assert.match(source("src/components/AppNav.tsx"), /href: "\/food", label: "nav\.food"/);
  assert.match(source("src/proxy.ts"), /"\/food"/);
  assert.match(source("src/components/AppFrame.tsx"), /"\/food"/);
  assert.match(source("src/app/globals.css"), /repeat\(var\(--nav-count, 6\)/);
});
