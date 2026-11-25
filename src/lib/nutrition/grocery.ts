/**
 * Grocery list generation from a week's meal plan (docs/nutrition-roadmap.md S4).
 * Pure functions: the Groceries tab builds the list, merges it with the saved
 * one and writes it only when something changed.
 */

/** Seed order (supabase/seed/food-catalog.json `grocery_sections`). */
export const GROCERY_SECTIONS = [
  "produce",
  "poultry",
  "meat",
  "fish",
  "dairy_eggs",
  "bakery",
  "grains_legumes",
  "nuts_dried",
  "pantry",
  "prepared",
] as const;
/** "Staples to check": ingredients without a food, shown only with staples on. */
export const STAPLES_SECTION = "staples";
/** Foods without a section and manual items without one. */
export const OTHER_SECTION = "other";
export type GrocerySection =
  | (typeof GROCERY_SECTIONS)[number]
  | typeof STAPLES_SECTION
  | typeof OTHER_SECTION;

const SECTION_ORDER: readonly string[] = [...GROCERY_SECTIONS, OTHER_SECTION, STAPLES_SECTION];

/** Grams used for a planned food that has no serving size. */
export const DEFAULT_FOOD_GRAMS = 100;
export const MAX_GROCERY_ITEMS = 500;
/** Stored amount limits (grocery_list_items checks). */
const MAX_GRAMS = 100000;
const MAX_COUNT = 10000;

export type GroceryFood = {
  id: string;
  name_en: string | null;
  name_fa: string | null;
  grocery_section: string | null;
  is_staple: boolean;
  count_unit_grams: number | null;
  serving_grams: number | null;
};

export type GroceryIngredient = {
  food_id: string | null;
  grams: number;
  is_staple: boolean;
  name_en: string | null;
  name_fa: string | null;
};

export type GroceryRecipe = {
  id: string;
  servings: number;
  ingredients: GroceryIngredient[];
};

export type GroceryPlanEntry = {
  recipe_id: string | null;
  food_id: string | null;
  cook_servings: number | null;
  eaten_portions: number;
};

export type GeneratedItem = {
  food_id: string | null;
  name_en: string | null;
  name_fa: string | null;
  grams: number | null;
  count: number | null;
  grocery_section: GrocerySection;
};

export type SavedGroceryItem = GeneratedItem & {
  id: string;
  have: boolean;
  bought: boolean;
  is_manual: boolean;
};

/** A merged item; `id` is null for items that are not saved yet. */
export type MergedGroceryItem = GeneratedItem & {
  id: string | null;
  have: boolean;
  bought: boolean;
  is_manual: boolean;
};

export function sectionOf(value: string | null | undefined): GrocerySection {
  return value && SECTION_ORDER.includes(value) ? (value as GrocerySection) : OTHER_SECTION;
}

export function sectionIndex(value: string): number {
  const index = SECTION_ORDER.indexOf(value);
  return index < 0 ? SECTION_ORDER.indexOf(OTHER_SECTION) : index;
}

function positive(value: number | null | undefined): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function sortKey(item: { name_en: string | null; name_fa: string | null }) {
  return (item.name_en ?? item.name_fa ?? "").toLocaleLowerCase("en");
}

function staplesKey(item: { name_en: string | null; name_fa: string | null }) {
  return `${(item.name_en ?? "").trim().toLowerCase()}|${(item.name_fa ?? "").trim()}`;
}

/** Steps 1–5: scale, sum by food, drop staples, then sort by section. */
export function generateGroceries(
  entries: GroceryPlanEntry[],
  recipes: Map<string, GroceryRecipe>,
  foods: Map<string, GroceryFood>,
  includeStaples: boolean,
): GeneratedItem[] {
  const gramsByFood = new Map<string, number>();
  const staples = new Map<string, GeneratedItem>();

  const addFood = (foodId: string, grams: number) => {
    if (grams > 0) gramsByFood.set(foodId, (gramsByFood.get(foodId) ?? 0) + grams);
  };

  for (const entry of entries) {
    if (entry.recipe_id) {
      const recipe = recipes.get(entry.recipe_id);
      if (!recipe) continue;
      const base = Math.max(1, positive(recipe.servings));
      const cook = positive(entry.cook_servings) || base;
      const factor = cook / base;
      for (const ingredient of recipe.ingredients) {
        if (ingredient.food_id) {
          const food = foods.get(ingredient.food_id);
          if ((ingredient.is_staple || food?.is_staple) && !includeStaples) continue;
          addFood(ingredient.food_id, positive(ingredient.grams) * factor);
        } else if (includeStaples) {
          const item: GeneratedItem = {
            food_id: null,
            name_en: ingredient.name_en?.trim() || null,
            name_fa: ingredient.name_fa?.trim() || null,
            grams: null,
            count: null,
            grocery_section: STAPLES_SECTION,
          };
          if (item.name_en || item.name_fa) staples.set(staplesKey(item), item);
        }
      }
    } else if (entry.food_id) {
      const food = foods.get(entry.food_id);
      if (food?.is_staple && !includeStaples) continue;
      const serving = positive(food?.serving_grams) || DEFAULT_FOOD_GRAMS;
      addFood(entry.food_id, serving * (positive(entry.eaten_portions) || 1));
    }
  }

  const items: GeneratedItem[] = [];
  for (const [foodId, grams] of gramsByFood) {
    const food = foods.get(foodId);
    if (!food || (!food.name_en && !food.name_fa)) continue;
    const unit = positive(food.count_unit_grams);
    items.push({
      food_id: foodId,
      name_en: food.name_en,
      name_fa: food.name_fa,
      grams: Math.min(MAX_GRAMS, Math.round(grams * 10) / 10),
      count: unit ? Math.min(MAX_COUNT, Math.ceil(grams / unit - 1e-9)) : null,
      grocery_section: sectionOf(food.grocery_section),
    });
  }
  items.push(...staples.values());

  return items
    .sort(
      (a, b) =>
        sectionIndex(a.grocery_section) - sectionIndex(b.grocery_section) ||
        sortKey(a).localeCompare(sortKey(b)),
    )
    .slice(0, MAX_GROCERY_ITEMS);
}

export type GroceryAmount =
  | { unit: "count"; value: number }
  | { unit: "kg"; value: number }
  | { unit: "g"; value: number };

/** Step 4: count for countable foods, kg (1 decimal) from 1000 g, else grams to 50 g. */
export function groceryAmount(item: Pick<GeneratedItem, "grams" | "count">): GroceryAmount | null {
  if (item.count !== null && item.count > 0) return { unit: "count", value: item.count };
  if (item.grams === null || !(item.grams > 0)) return null;
  if (item.grams >= 1000) return { unit: "kg", value: Math.round(item.grams / 100) / 10 };
  return { unit: "g", value: Math.max(50, Math.round(item.grams / 50) * 50) };
}

/**
 * Step 6: merge a regenerated list with the saved one. Items keep their saved id
 * and have/bought flags by food (staples by name); manual items stay; saved items
 * whose food no longer appears are dropped unless already bought.
 */
export function mergeGroceries(
  saved: SavedGroceryItem[],
  generated: GeneratedItem[],
): MergedGroceryItem[] {
  const savedByKey = new Map<string, SavedGroceryItem>();
  for (const item of saved) {
    if (item.is_manual) continue;
    const key = item.food_id ? `food:${item.food_id}` : `staple:${staplesKey(item)}`;
    if (!savedByKey.has(key)) savedByKey.set(key, item);
  }

  const used = new Set<string>();
  const kept = saved.filter((item) => item.is_manual || item.bought).length;
  // Trim generated items, never manual or bought ones, to stay under the cap.
  const room = Math.max(0, MAX_GROCERY_ITEMS - kept);
  const merged: MergedGroceryItem[] = generated.slice(0, room).map((item) => {
    const key = item.food_id ? `food:${item.food_id}` : `staple:${staplesKey(item)}`;
    const match = savedByKey.get(key);
    if (match) {
      used.add(match.id);
      return { ...item, id: match.id, have: match.have, bought: match.bought, is_manual: false };
    }
    return { ...item, id: null, have: false, bought: false, is_manual: false };
  });

  for (const item of saved) {
    if (!item.is_manual && !used.has(item.id) && item.bought) merged.push({ ...item });
  }
  for (const item of saved) {
    if (item.is_manual) merged.push({ ...item });
  }
  return merged;
}

function sameNumber(a: number | null, b: number | null) {
  return (a === null || a === undefined ? null : Number(a)) === (b === null || b === undefined ? null : Number(b));
}

/** True when writing `merged` would change the saved list (ignores have/bought). */
export function groceriesChanged(
  saved: SavedGroceryItem[],
  merged: MergedGroceryItem[],
): boolean {
  if (saved.length !== merged.length) return true;
  return merged.some((item, index) => {
    const before = saved[index];
    return (
      !before ||
      item.id !== before.id ||
      item.food_id !== before.food_id ||
      item.name_en !== before.name_en ||
      item.name_fa !== before.name_fa ||
      !sameNumber(item.grams, before.grams) ||
      !sameNumber(item.count, before.count) ||
      item.grocery_section !== before.grocery_section ||
      item.is_manual !== before.is_manual
    );
  });
}

/** Unticked items form the shopping list. */
export function needsBuying(item: { have: boolean; bought: boolean }) {
  return !item.have && !item.bought;
}
