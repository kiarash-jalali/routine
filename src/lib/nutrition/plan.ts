/**
 * Weekly meal plan helpers (docs/nutrition-roadmap.md S4). Pure functions shared
 * by the Plan tab, the Groceries tab and the reminder sender.
 */
import { addNutrition, foodNutrition, scaleNutrition, type Nutrition, type Per100g } from "./food";
import { perServing, type IngredientWithFood } from "./recipe";

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];
export const PORTION_CHOICES = [0.5, 1, 1.5, 2] as const;
export const MIN_PORTIONS = 0.25;
export const MAX_PORTIONS = 20;
export const MAX_ENTRIES_PER_SLOT = 20;

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ZERO: Nutrition = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };

export function isMealSlot(value: unknown): value is MealSlot {
  return typeof value === "string" && (MEAL_SLOTS as readonly string[]).includes(value);
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

/** Start of the week containing `day` (same rule as body.weekStart). */
export function startOfWeek(day: string, weekStartsOn: number): string {
  return addDays(day, -((weekdayOf(day) - weekStartsOn + 7) % 7));
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/** `week` URL param → week start: "next", a date inside the week, or this week. */
export function resolveWeekStart(
  param: string | null | undefined,
  today: string,
  weekStartsOn: number,
): string {
  const current = startOfWeek(today, weekStartsOn);
  if (param === "next") return addDays(current, 7);
  if (isDateKey(param)) return startOfWeek(param, weekStartsOn);
  return current;
}

export function clampPortions(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_PORTIONS, Math.max(MIN_PORTIONS, Math.round(value * 4) / 4));
}

export type PlanRecipe = { servings: number; ingredients: IngredientWithFood[] };
export type PlanFood = { per100: Per100g; serving_grams: number | null };
export type PlanEntryLike = {
  plan_date: string;
  slot: string;
  position: number;
  recipe_id: string | null;
  food_id: string | null;
  cook_servings: number | null;
  eaten_portions: number;
};

/** What the user eats from one entry: recipe per serving or food serving × portions. */
export function entryNutrition(
  entry: Pick<PlanEntryLike, "recipe_id" | "food_id" | "eaten_portions">,
  recipes: Map<string, PlanRecipe>,
  foods: Map<string, PlanFood>,
): Nutrition | null {
  const portions = Number(entry.eaten_portions) || 0;
  if (entry.recipe_id) {
    const recipe = recipes.get(entry.recipe_id);
    if (!recipe) return null;
    return scaleNutrition(perServing(recipe.ingredients, recipe.servings), portions);
  }
  if (entry.food_id) {
    const food = foods.get(entry.food_id);
    if (!food) return null;
    const serving = Number(food.serving_grams) > 0 ? Number(food.serving_grams) : 100;
    return foodNutrition(food.per100, serving * portions);
  }
  return null;
}

export function dayTotals(
  entries: PlanEntryLike[],
  day: string,
  recipes: Map<string, PlanRecipe>,
  foods: Map<string, PlanFood>,
): Nutrition {
  return entries
    .filter((entry) => entry.plan_date === day)
    .reduce((total, entry) => {
      const value = entryNutrition(entry, recipes, foods);
      return value ? addNutrition(total, value) : total;
    }, ZERO);
}

/** Average over the planned days of the week (days with at least one entry). */
export function weekAverage(
  entries: PlanEntryLike[],
  weekStart: string,
  recipes: Map<string, PlanRecipe>,
  foods: Map<string, PlanFood>,
): Nutrition | null {
  const planned = weekDays(weekStart).filter((day) =>
    entries.some((entry) => entry.plan_date === day),
  );
  if (planned.length === 0) return null;
  const total = planned.reduce(
    (sum, day) => addNutrition(sum, dayTotals(entries, day, recipes, foods)),
    ZERO,
  );
  return scaleNutrition(total, 1 / planned.length);
}

export function nextPosition(entries: PlanEntryLike[], day: string, slot: string): number {
  return entries
    .filter((entry) => entry.plan_date === day && entry.slot === slot)
    .reduce((max, entry) => Math.max(max, entry.position + 1), 0);
}

export type CopiedEntry = Omit<PlanEntryLike, "position"> & { position: number; note: string | null };

/**
 * "Copy last week": the previous week's entries moved 7 days forward, placed
 * after anything already planned in the same slot.
 */
export function copyWeekEntries(
  previous: (PlanEntryLike & { note?: string | null })[],
  previousWeekStart: string,
  current: PlanEntryLike[],
): CopiedEntry[] {
  const days = new Set(weekDays(previousWeekStart));
  const next = new Map<string, number>();
  return previous
    .filter((entry) => days.has(entry.plan_date))
    .sort((a, b) => a.plan_date.localeCompare(b.plan_date) || a.position - b.position)
    .map((entry) => {
      const day = addDays(entry.plan_date, 7);
      const key = `${day}:${entry.slot}`;
      const position = next.get(key) ?? nextPosition(current, day, entry.slot);
      next.set(key, position + 1);
      return {
        plan_date: day,
        slot: entry.slot,
        position,
        recipe_id: entry.recipe_id,
        food_id: entry.food_id,
        cook_servings: entry.cook_servings,
        eaten_portions: entry.eaten_portions,
        note: entry.note ?? null,
      };
    })
    .filter((entry) => entry.position <= 100);
}
