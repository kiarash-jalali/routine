/**
 * Recipe helpers for the recipes UI (docs/nutrition-roadmap.md S3, §4.4).
 * Pure functions: servings scaling, copy payloads and editor validation.
 */
import { recipePerServing, type Nutrition, type Per100g } from "./food";

export const RECIPE_CATEGORIES = ["breakfast", "rice", "main", "soup", "side", "snack"] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

/** Tags with translated chips. Recipe tags are free text in the schema; others are hidden. */
export const RECIPE_TAGS = [
  "quick",
  "batch",
  "one_pot",
  "legume",
  "fish",
  "red_meat",
  "low_protein",
  "treat",
  "seasonal",
  "night",
] as const;
export type RecipeTag = (typeof RECIPE_TAGS)[number];

export const FOOD_TAGS = [
  "red_meat",
  "organ_meat",
  "fish",
  "seafood",
  "legume",
  "high_sugar",
  "fried",
  "high_salt",
] as const;
export type FoodTag = (typeof FOOD_TAGS)[number];

export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 20;
export const MAX_GRAMS = 5000;
export const MAX_INGREDIENTS = 60;
export const MAX_STEPS = 30;
export const MAX_STEP_CHARS = 8000;
export const MAX_TAGS = 12;

export type Language = "en" | "fa";

/** The user's language first, the other one as a fallback (§6). */
export function localizedName(
  language: Language,
  en: string | null | undefined,
  fa: string | null | undefined,
): string {
  const first = language === "fa" ? fa : en;
  const second = language === "fa" ? en : fa;
  return first?.trim() || second?.trim() || "";
}

export function clampServings(value: number): number {
  if (!Number.isFinite(value)) return MIN_SERVINGS;
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(value)));
}

/** Factor that turns the recipe's base amounts into amounts for `chosen` servings. */
export function servingsFactor(base: number, chosen: number): number {
  return clampServings(chosen) / Math.max(MIN_SERVINGS, base);
}

/** Grams for a scaled ingredient, rounded to whole grams (one decimal under 10 g). */
export function scaleGrams(grams: number, factor: number): number {
  const value = Math.max(0, grams) * factor;
  return value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
}

export type IngredientWithFood = {
  grams: number;
  food: Per100g | null;
};

/** Per-serving nutrition; it does not change with the servings stepper. */
export function perServing(ingredients: IngredientWithFood[], servings: number): Nutrition {
  return recipePerServing(
    ingredients.map((item) => ({ food: item.food, grams: Number(item.grams) })),
    servings,
  );
}

/** Nutrition for `chosen` servings of a recipe written for `base` servings. */
export function nutritionForServings(
  ingredients: IngredientWithFood[],
  base: number,
  chosen: number,
): Nutrition {
  const one = perServing(ingredients, base);
  const count = clampServings(chosen);
  return {
    kcal: one.kcal * count,
    protein: one.protein * count,
    fat: one.fat * count,
    carbs: one.carbs * count,
    fiber: one.fiber * count,
  };
}

export type RecipeFields = {
  title_en: string | null;
  title_fa: string | null;
  category: string;
  servings: number;
  steps_en: string[];
  steps_fa: string[];
  tip_en: string | null;
  tip_fa: string | null;
  tags: string[];
  suggested_side_food_id: string | null;
  suggested_side_grams: number | null;
};

export type IngredientFields = {
  food_id: string | null;
  name_en: string | null;
  name_fa: string | null;
  grams: number;
  amount_en: string | null;
  amount_fa: string | null;
  is_staple: boolean;
};

export type RecipePayload = RecipeFields & { copied_from: string | null };

/** "Save to my recipes": a user-owned copy, never the catalog row itself. */
export function recipeCopyPayload(
  recipe: RecipeFields & { id: string },
  ingredients: ReadonlyArray<IngredientFields & { position?: number }>,
): { recipe: RecipePayload; ingredients: IngredientFields[] } {
  return {
    recipe: {
      title_en: recipe.title_en,
      title_fa: recipe.title_fa,
      category: recipe.category,
      servings: recipe.servings,
      steps_en: [...recipe.steps_en],
      steps_fa: [...recipe.steps_fa],
      tip_en: recipe.tip_en,
      tip_fa: recipe.tip_fa,
      tags: [...recipe.tags],
      suggested_side_food_id: recipe.suggested_side_food_id,
      suggested_side_grams: recipe.suggested_side_grams,
      copied_from: recipe.id,
    },
    ingredients: [...ingredients]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((item) => ({
        food_id: item.food_id,
        name_en: item.name_en,
        name_fa: item.name_fa,
        grams: Number(item.grams),
        amount_en: item.amount_en,
        amount_fa: item.amount_fa,
        is_staple: item.is_staple,
      })),
  };
}

export type RecipeDraftError =
  | "title"
  | "servings"
  | "ingredients"
  | "ingredientName"
  | "grams"
  | "steps"
  | "tags";

/** Editor validation, mirroring the table checks. */
export function validateRecipeDraft(
  recipe: Pick<RecipeFields, "title_en" | "title_fa" | "servings" | "steps_en" | "steps_fa"> & {
    tags?: ReadonlyArray<string>;
  },
  ingredients: ReadonlyArray<Pick<IngredientFields, "food_id" | "name_en" | "name_fa" | "grams">>,
): RecipeDraftError | null {
  if (!recipe.title_en?.trim() && !recipe.title_fa?.trim()) return "title";
  if (
    !Number.isInteger(recipe.servings) ||
    recipe.servings < MIN_SERVINGS ||
    recipe.servings > MAX_SERVINGS
  )
    return "servings";
  if (ingredients.length > MAX_INGREDIENTS) return "ingredients";
  if (
    recipe.steps_en.length > MAX_STEPS ||
    recipe.steps_fa.length > MAX_STEPS ||
    recipe.steps_en.join("").length > MAX_STEP_CHARS ||
    recipe.steps_fa.join("").length > MAX_STEP_CHARS
  )
    return "steps";
  if ((recipe.tags?.length ?? 0) > MAX_TAGS) return "tags";
  for (const item of ingredients) {
    if (!item.food_id && !item.name_en?.trim() && !item.name_fa?.trim()) return "ingredientName";
    if (!Number.isFinite(item.grams) || item.grams < 0 || item.grams > MAX_GRAMS) return "grams";
  }
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route ids are checked before querying, so a typo is a 404, not a load error. */
export function isRecipeId(value: string): boolean {
  return UUID.test(value);
}

/** Persian/Arabic digits to Latin, so "۱۵۰" typed on a Persian keyboard parses. */
export function toLatinDigits(text: string): string {
  return text
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/٫/g, ".");
}

/** Number from a form field; empty or unparsable text is NaN (never silently 0). */
export function parseAmount(text: string): number {
  const value = toLatinDigits(text).trim();
  return value === "" ? Number.NaN : Number(value);
}
