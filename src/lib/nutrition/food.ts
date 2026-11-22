/**
 * Food and recipe nutrition (docs/nutrition-roadmap.md §4.4).
 * Pure functions shared by UI and server; no formulas elsewhere.
 */

export type Per100g = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
};

export type Nutrition = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
};

export type RecipeIngredientInput = {
  /** Per-100 g values of the linked food; null for spices / "salt to taste". */
  food: Per100g | null;
  grams: number;
};

const ZERO: Nutrition = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };

/** Nutrition of `grams` of a food: value × grams / 100. */
export function foodNutrition(per100: Per100g, grams: number): Nutrition {
  const factor = (Number.isFinite(grams) ? Math.max(0, grams) : 0) / 100;
  return {
    kcal: per100.kcal * factor,
    protein: per100.protein * factor,
    fat: per100.fat * factor,
    carbs: per100.carbs * factor,
    fiber: (per100.fiber ?? 0) * factor,
  };
}

export function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
    fiber: a.fiber + b.fiber,
  };
}

export function scaleNutrition(value: Nutrition, factor: number): Nutrition {
  return {
    kcal: value.kcal * factor,
    protein: value.protein * factor,
    fat: value.fat * factor,
    carbs: value.carbs * factor,
    fiber: value.fiber * factor,
  };
}

/** Σ(ingredient per-100 × grams / 100); ingredients without a food add 0. */
export function recipeTotal(ingredients: RecipeIngredientInput[]): Nutrition {
  return ingredients.reduce(
    (total, item) =>
      item.food ? addNutrition(total, foodNutrition(item.food, item.grams)) : total,
    ZERO,
  );
}

/** Recipe nutrition for one serving. */
export function recipePerServing(
  ingredients: RecipeIngredientInput[],
  servings: number,
): Nutrition {
  return scaleNutrition(recipeTotal(ingredients), 1 / Math.max(1, servings));
}

/** Storage rounding: kcal to integers, macros to 1 decimal. */
export function roundForStorage(value: Nutrition): Nutrition {
  const one = (n: number) => Math.round(n * 10) / 10;
  return {
    kcal: Math.round(value.kcal),
    protein: one(value.protein),
    fat: one(value.fat),
    carbs: one(value.carbs),
    fiber: one(value.fiber),
  };
}
