import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { IngredientFields, RecipePayload } from "@/lib/nutrition/recipe";

// Catalog rows (owner_id null) are read-only: every write below is scoped to the
// caller's own rows, and RLS rejects anything else (docs/nutrition-roadmap.md §3).

const per100Columns = "kcal_100g,protein_100g,fat_100g,carbs_100g,fiber_100g";
const foodColumns = `id,owner_id,kind,region,category,name_en,name_fa,${per100Columns},serving_grams,serving_label_en,serving_label_fa,is_staple,tags`;
const recipeSummaryColumns = `id,owner_id,title_en,title_fa,category,servings,tags,updated_at,ingredients:recipe_ingredients!recipe_ingredients_recipe_id_fkey(grams,food:foods(${per100Columns}))`;
const recipeColumns = `id,owner_id,title_en,title_fa,category,servings,steps_en,steps_fa,tip_en,tip_fa,tags,suggested_side_food_id,suggested_side_grams,copied_from,side:foods!recipes_suggested_side_food_id_fkey(id,name_en,name_fa,${per100Columns})`;
const ingredientColumns = `id,position,food_id,name_en,name_fa,grams,amount_en,amount_fa,is_staple,food:foods(id,name_en,name_fa,${per100Columns})`;

type Client = SupabaseClient<Database>;

/** Foods visible to the user: the shared catalog plus their own. */
export async function listFoods(client?: Client) {
  const { data, error } = await (client ?? supabaseBrowser())
    .from("foods")
    .select(foodColumns)
    .order("kind")
    .order("name_en")
    .limit(2000);
  if (error) throw new Error("food_load_failed");
  return data ?? [];
}

export async function listRecipes(client?: Client) {
  const { data, error } = await (client ?? supabaseBrowser())
    .from("recipes")
    .select(recipeSummaryColumns)
    .order("owner_id", { nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("recipe_load_failed");
  return data ?? [];
}

export async function loadFoodHub(client?: Client) {
  const [recipes, foods] = await Promise.all([listRecipes(client), listFoods(client)]);
  return { recipes, foods };
}

export type FoodHubData = Awaited<ReturnType<typeof loadFoodHub>>;
export type FoodRow = FoodHubData["foods"][number];
export type RecipeSummary = FoodHubData["recipes"][number];

/** A recipe with ordered ingredients; null when it doesn't exist or isn't visible. */
export async function loadRecipe(id: string, client?: Client) {
  const db = client ?? supabaseBrowser();
  const [recipe, ingredients] = await Promise.all([
    db.from("recipes").select(recipeColumns).eq("id", id).maybeSingle(),
    db
      .from("recipe_ingredients")
      .select(ingredientColumns)
      .eq("recipe_id", id)
      .order("position"),
  ]);
  if (recipe.error || ingredients.error) throw new Error("recipe_load_failed");
  if (!recipe.data) return null;
  return { recipe: recipe.data, ingredients: ingredients.data ?? [] };
}

export type RecipeDetail = NonNullable<Awaited<ReturnType<typeof loadRecipe>>>;

/** Insert (id null) or update the user's own recipe and replace its ingredients atomically. */
export async function saveRecipe(
  id: string | null,
  recipe: RecipePayload,
  ingredients: IngredientFields[],
): Promise<string> {
  const { data, error } = await supabaseBrowser().rpc("save_recipe", {
    // The function type was written by hand with `string | null`; generated
    // types say `string`, so keep this when regenerating (null inserts).
    p_recipe_id: id,
    p_recipe: recipe as unknown as Json,
    p_ingredients: ingredients as unknown as Json,
  });
  if (error || !data) throw new Error("recipe_save_failed");
  return data;
}

export async function deleteRecipe(userId: string, id: string) {
  const { error, count } = await supabaseBrowser()
    .from("recipes")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error || count === 0) throw new Error("recipe_delete_failed");
}

export type FoodInput = {
  kind: "ingredient" | "dish";
  name_en: string | null;
  name_fa: string | null;
  kcal_100g: number;
  protein_100g: number;
  fat_100g: number;
  carbs_100g: number;
  fiber_100g: number;
  serving_grams: number | null;
  serving_label_en: string | null;
  serving_label_fa: string | null;
};

export async function saveFood(userId: string, values: FoodInput, id?: string) {
  const db = supabaseBrowser();
  const { error, count } = await (id
    ? db.from("foods").update(values, { count: "exact" }).eq("id", id).eq("owner_id", userId)
    : db.from("foods").insert({ ...values, owner_id: userId, source: "user" }, { count: "exact" }));
  // A food that vanished between opening and saving fails instead of looking saved.
  if (error || count === 0) throw new Error("food_save_failed");
}

/** Recipes that used the food keep a named line (foods_keep_ingredient_names trigger). */
export async function deleteFood(userId: string, id: string) {
  const { error, count } = await supabaseBrowser()
    .from("foods")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error || count === 0) throw new Error("food_delete_failed");
}
