import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { defaultWeekStart } from "@/lib/nutrition/body";
import { dailyTargets } from "@/lib/nutrition/log";
import {
  OTHER_SECTION,
  sectionOf,
  type GroceryFood,
  type GroceryRecipe,
  type MergedGroceryItem,
  type SavedGroceryItem,
} from "@/lib/nutrition/grocery";
import { addDays, copyWeekEntries, type MealSlot } from "@/lib/nutrition/plan";

// Meal plans and grocery lists are personal data: ids only in logs and errors,
// generic copy only in push payloads (docs/nutrition-roadmap.md §3).

type Client = SupabaseClient<Database>;

const entryColumns =
  "id,plan_date,slot,position,recipe_id,food_id,cook_servings,eaten_portions,note";
const listColumns = "id,week_start,generated_at,include_staples";
const itemColumns =
  "id,food_id,name_en,name_fa,grams,count,grocery_section,have,bought,is_manual,position";

export type PlanEntry = {
  id: string;
  plan_date: string;
  slot: string;
  position: number;
  recipe_id: string | null;
  food_id: string | null;
  cook_servings: number | null;
  eaten_portions: number;
  note: string | null;
};

export type PlanTargets = {
  kcal: number | null;
  protein: number;
  proteinMode: "auto" | "limit" | "custom";
} | null;

function toEntry(row: PlanEntry): PlanEntry {
  return {
    ...row,
    position: Number(row.position),
    cook_servings: row.cook_servings === null ? null : Number(row.cook_servings),
    eaten_portions: Number(row.eaten_portions),
  };
}

/** The user's week start: body profile first, then the language default. */
export async function getWeekStartsOn(userId: string, language: string, client?: Client) {
  const { data, error } = await (client ?? supabaseBrowser())
    .from("body_profiles")
    .select("week_starts_on")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("plan_load_failed");
  return data?.week_starts_on ?? defaultWeekStart(language);
}

/** Entries for the week starting on `weekStart` and the week before it (for "Copy last week"). */
export async function loadPlanEntries(weekStart: string, client?: Client) {
  const { data, error } = await (client ?? supabaseBrowser())
    .from("meal_plan_entries")
    .select(entryColumns)
    .gte("plan_date", addDays(weekStart, -7))
    .lte("plan_date", addDays(weekStart, 6))
    .order("plan_date")
    .order("slot")
    .order("position")
    .limit(1000);
  if (error) throw new Error("plan_load_failed");
  return (data ?? []).map(toEntry);
}

/**
 * Daily kcal and protein targets for the plan totals. Body values stay on the
 * server: only the two target numbers reach the page.
 */
export async function loadPlanTargets(
  userId: string,
  today: string,
  client: Client,
): Promise<PlanTargets> {
  const [profile, weights, adjustments] = await Promise.all([
    client
      .from("body_profiles")
      .select(
        "sex,birth_year,height_cm,activity_level,goal_mode,goal_weight_kg,goal_rate_kg_week,kcal_target_override,protein_mode,protein_grams",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("body_measurements")
      .select("measured_on,weight_kg")
      .eq("user_id", userId)
      .not("weight_kg", "is", null)
      .gte("measured_on", addDays(today, -90))
      .order("measured_on")
      .limit(120),
    client
      .from("target_adjustments")
      .select("effective_from,delta_kcal")
      .eq("user_id", userId)
      .lte("effective_from", today),
  ]);
  if (profile.error || weights.error || adjustments.error) throw new Error("plan_targets_failed");
  if (!profile.data) return null;
  const values = {
    ...profile.data,
    height_cm: Number(profile.data.height_cm),
    goal_weight_kg: profile.data.goal_weight_kg === null ? null : Number(profile.data.goal_weight_kg),
    goal_rate_kg_week:
      profile.data.goal_rate_kg_week === null ? null : Number(profile.data.goal_rate_kg_week),
  };
  // The same targets as Today and the Log tab (S5), accepted adjustments included.
  const result = dailyTargets(
    values,
    (weights.data ?? []).map((row) => ({ day: row.measured_on, weightKg: Number(row.weight_kg) })),
    adjustments.data ?? [],
    today,
  );
  if (!result) return null;
  return {
    kcal: result.energy.kcal,
    protein: result.protein.grams,
    proteinMode: result.protein.mode,
  };
}

export type EntryInput = {
  plan_date: string;
  slot: MealSlot;
  position: number;
  recipe_id: string | null;
  food_id: string | null;
  cook_servings: number | null;
  eaten_portions: number;
  note: string | null;
};

export async function addPlanEntry(userId: string, values: EntryInput) {
  const { error } = await supabaseBrowser()
    .from("meal_plan_entries")
    .insert({ ...values, user_id: userId });
  if (error) throw new Error("plan_save_failed");
}

export async function updatePlanEntry(
  userId: string,
  id: string,
  values: Partial<Omit<EntryInput, "recipe_id" | "food_id">>,
) {
  const { error, count } = await supabaseBrowser()
    .from("meal_plan_entries")
    .update(values, { count: "exact" })
    .eq("id", id)
    .eq("user_id", userId);
  if (error || count === 0) throw new Error("plan_save_failed");
}

export async function deletePlanEntry(userId: string, id: string) {
  const { error } = await supabaseBrowser()
    .from("meal_plan_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error("plan_delete_failed");
}

/** Copies last week's entries into this week (one insert, so all or nothing). */
export async function copyLastWeek(userId: string, weekStart: string, entries: PlanEntry[]) {
  const rows = copyWeekEntries(
    entries,
    addDays(weekStart, -7),
    entries.filter((entry) => entry.plan_date >= weekStart),
  ).map((row) => ({ ...row, user_id: userId }));
  if (rows.length === 0) return 0;
  const { error } = await supabaseBrowser().from("meal_plan_entries").insert(rows);
  if (error) throw new Error("plan_save_failed");
  return rows.length;
}

export async function clearWeek(userId: string, weekStart: string) {
  const { error } = await supabaseBrowser()
    .from("meal_plan_entries")
    .delete()
    .eq("user_id", userId)
    .gte("plan_date", weekStart)
    .lte("plan_date", addDays(weekStart, 6));
  if (error) throw new Error("plan_delete_failed");
}

// ---------- Groceries ----------

export type GroceryList = {
  id: string;
  week_start: string;
  generated_at: string;
  include_staples: boolean;
  items: SavedGroceryItem[];
} | null;

function toSavedItem(row: {
  id: string;
  food_id: string | null;
  name_en: string | null;
  name_fa: string | null;
  grams: number | null;
  count: number | null;
  grocery_section: string | null;
  have: boolean;
  bought: boolean;
  is_manual: boolean;
}): SavedGroceryItem {
  return {
    id: row.id,
    food_id: row.food_id,
    name_en: row.name_en,
    name_fa: row.name_fa,
    grams: row.grams === null ? null : Number(row.grams),
    count: row.count === null ? null : Number(row.count),
    grocery_section: sectionOf(row.grocery_section),
    have: row.have,
    bought: row.bought,
    is_manual: row.is_manual,
  };
}

export async function loadGroceryList(weekStart: string, client?: Client): Promise<GroceryList> {
  const db = client ?? supabaseBrowser();
  const { data: list, error } = await db
    .from("grocery_lists")
    .select(listColumns)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw new Error("grocery_load_failed");
  if (!list) return null;
  const { data: items, error: itemError } = await db
    .from("grocery_list_items")
    .select(itemColumns)
    .eq("list_id", list.id)
    .order("position")
    .limit(600);
  if (itemError) throw new Error("grocery_load_failed");
  return { ...list, items: (items ?? []).map(toSavedItem) };
}

/** What grocery generation needs for the planned recipes and foods. */
export async function loadGroceryInputs(recipeIds: string[], foodIds: string[]) {
  const db = supabaseBrowser();
  const foodColumns = "id,name_en,name_fa,grocery_section,is_staple,count_unit_grams,serving_grams";
  const [recipes, foods] = await Promise.all([
    recipeIds.length
      ? db
          .from("recipes")
          .select(
            `id,servings,ingredients:recipe_ingredients!recipe_ingredients_recipe_id_fkey(food_id,grams,is_staple,name_en,name_fa,food:foods(${foodColumns}))`,
          )
          .in("id", recipeIds)
      : Promise.resolve({ data: [], error: null }),
    foodIds.length
      ? db.from("foods").select(foodColumns).in("id", foodIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (recipes.error || foods.error) throw new Error("grocery_load_failed");

  const foodMap = new Map<string, GroceryFood>();
  const addFood = (row: GroceryFood | null) => {
    if (!row) return;
    foodMap.set(row.id, {
      ...row,
      count_unit_grams: row.count_unit_grams === null ? null : Number(row.count_unit_grams),
      serving_grams: row.serving_grams === null ? null : Number(row.serving_grams),
    });
  };
  for (const row of foods.data ?? []) addFood(row);
  const recipeMap = new Map<string, GroceryRecipe>();
  for (const row of recipes.data ?? []) {
    for (const ingredient of row.ingredients) addFood(ingredient.food);
    recipeMap.set(row.id, {
      id: row.id,
      servings: row.servings,
      ingredients: row.ingredients.map((ingredient) => ({
        food_id: ingredient.food_id,
        grams: Number(ingredient.grams),
        is_staple: ingredient.is_staple,
        name_en: ingredient.name_en,
        name_fa: ingredient.name_fa,
      })),
    });
  }
  return { recipes: recipeMap, foods: foodMap };
}

/** Writes a merged list in one transaction (save_grocery_list RPC). */
export async function saveGroceryList(
  weekStart: string,
  includeStaples: boolean,
  items: MergedGroceryItem[],
) {
  const payload = items.map((item) => ({
    id: item.id,
    food_id: item.food_id,
    name_en: item.name_en,
    name_fa: item.name_fa,
    grams: item.grams,
    count: item.count,
    // "other" is a display group; it is stored as no section.
    grocery_section: item.grocery_section === OTHER_SECTION ? null : item.grocery_section,
    have: item.have,
    bought: item.bought,
    is_manual: item.is_manual,
  }));
  const { error } = await supabaseBrowser().rpc("save_grocery_list", {
    p_week_start: weekStart,
    p_include_staples: includeStaples,
    p_items: payload as unknown as Json,
  });
  if (error) throw new Error("grocery_save_failed");
}

export type GroceryFlag = "have" | "bought";

export async function setGroceryFlag(userId: string, id: string, field: GroceryFlag, value: boolean) {
  const update = field === "have" ? { have: value } : { bought: value };
  const { error, count } = await supabaseBrowser()
    .from("grocery_list_items")
    .update(update, { count: "exact" })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
  if (count === 0) throw new Error("grocery_item_missing");
}

/** Adds one manual item (creating the list if needed) without rewriting the rest. */
export async function addManualItem(weekStart: string, name: { name_en: string | null; name_fa: string | null }) {
  const { error } = await supabaseBrowser().rpc("add_grocery_item", {
    p_week_start: weekStart,
    p_name_en: name.name_en ?? "",
    p_name_fa: name.name_fa ?? "",
  });
  if (error) throw new Error("grocery_save_failed");
}

export async function deleteGroceryItem(userId: string, id: string) {
  const { error } = await supabaseBrowser()
    .from("grocery_list_items")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error("grocery_delete_failed");
}
