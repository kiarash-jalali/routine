/**
 * Food logging (docs/nutrition-roadmap.md S5, §4.4).
 * Pure functions shared by UI and server. A log entry is a snapshot: label and
 * macros are copied when it is written, so later edits to a food or recipe
 * never change history. Health data (diet): never log these values.
 */
import { roundForStorage, foodNutrition, type Nutrition, type Per100g } from "./food";
import {
  dayFromNumber,
  dayNumber,
  energyTarget,
  kcalFloor,
  proteinTarget,
  trendWeights,
  type BodyProfileLike,
  type EnergyTarget,
  type ProteinTarget,
  type WeighIn,
} from "./body";

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];
export type LogSource = "plan" | "recipe" | "food" | "quick";

/** Portion choices for recipes and planned meals (½, 1, 1½, 2). */
export const PORTION_OPTIONS = [0.5, 1, 1.5, 2] as const;
export const MIN_PORTIONS = 0.25;
export const MAX_PORTIONS = 20;
export const MAX_LOG_GRAMS = 5000;
export const MAX_LABEL_CHARS = 200;
export const MAX_KCAL = 10000;
export const MAX_MACRO = 1000;

export type Macros = { kcal: number; protein: number; fat: number; carbs: number };

/** The fields a new entry needs besides user_id and eaten_on. */
export type LogDraft = Macros & {
  slot: MealSlot;
  source: LogSource;
  food_id: string | null;
  recipe_id: string | null;
  portions: number | null;
  grams: number | null;
  label: string;
};

export function isMealSlot(value: string): value is MealSlot {
  return (MEAL_SLOTS as ReadonlyArray<string>).includes(value);
}

function cleanLabel(label: string): string {
  // Code points, like the table check, so an emoji is never cut in half.
  return Array.from(label.trim()).slice(0, MAX_LABEL_CHARS).join("");
}

/** Storage rounding (§4.4) and the table's ranges. */
function snapshot(value: Nutrition | Macros): Macros {
  const rounded = roundForStorage({ fiber: 0, ...value });
  const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));
  return {
    kcal: clamp(rounded.kcal, MAX_KCAL),
    protein: clamp(rounded.protein, MAX_MACRO),
    fat: clamp(rounded.fat, MAX_MACRO),
    carbs: clamp(rounded.carbs, MAX_MACRO),
  };
}

/** `grams` of a food. */
export function entryFromFood(
  food: { id: string; per100: Per100g },
  grams: number,
  label: string,
  slot: MealSlot,
): LogDraft {
  return {
    slot,
    source: "food",
    food_id: food.id,
    recipe_id: null,
    portions: null,
    grams: Math.round(grams * 10) / 10,
    label: cleanLabel(label),
    ...snapshot(foodNutrition(food.per100, grams)),
  };
}

/** `portions` servings of a recipe, from its per-serving nutrition. */
export function entryFromRecipe(
  recipe: { id: string; perServing: Nutrition },
  portions: number,
  label: string,
  slot: MealSlot,
): LogDraft {
  const p = recipe.perServing;
  return {
    slot,
    source: "recipe",
    food_id: null,
    recipe_id: recipe.id,
    portions,
    grams: null,
    label: cleanLabel(label),
    ...snapshot({
      kcal: p.kcal * portions,
      protein: p.protein * portions,
      fat: p.fat * portions,
      carbs: p.carbs * portions,
    }),
  };
}

/** Quick calories: kcal and optional protein with a label. */
export function entryFromQuick(
  values: { label: string; kcal: number; protein: number | null },
  slot: MealSlot,
): LogDraft {
  return {
    slot,
    source: "quick",
    food_id: null,
    recipe_id: null,
    portions: null,
    grams: null,
    label: cleanLabel(values.label),
    ...snapshot({ kcal: values.kcal, protein: values.protein ?? 0, fat: 0, carbs: 0 }),
  };
}

/** A recent item logged again: same item, same amount, same snapshot. */
export function entryFromRecent(entry: Omit<LogDraft, "slot">, slot: MealSlot): LogDraft {
  return {
    slot,
    source: entry.source === "plan" ? (entry.recipe_id ? "recipe" : "food") : entry.source,
    food_id: entry.food_id,
    recipe_id: entry.recipe_id,
    portions: entry.portions,
    grams: entry.grams,
    label: entry.label,
    ...snapshot(entry),
  };
}

type Amount = { portions: number | null; grams: number | null };

/**
 * Editing the amount scales the stored snapshot; it never re-reads the food or
 * recipe, so an edited recipe does not leak into old entries.
 */
export function rescaleEntry(
  entry: Macros & Amount,
  next: { portions?: number; grams?: number },
): Macros & Amount {
  let ratio: number | null = null;
  if (next.portions !== undefined && entry.portions) ratio = next.portions / Number(entry.portions);
  if (next.grams !== undefined && entry.grams) ratio = next.grams / Number(entry.grams);
  if (ratio === null || !Number.isFinite(ratio) || ratio <= 0) return { ...entry };
  return {
    portions: next.portions ?? entry.portions,
    grams: next.grams ?? entry.grams,
    ...snapshot({
      kcal: Number(entry.kcal) * ratio,
      protein: Number(entry.protein) * ratio,
      fat: Number(entry.fat) * ratio,
      carbs: Number(entry.carbs) * ratio,
    }),
  };
}

/** Sum of entries (totals always match the entries shown). */
export function dayTotals(entries: ReadonlyArray<Macros>): Macros {
  const total = entries.reduce(
    (sum, e) => ({
      kcal: sum.kcal + Number(e.kcal),
      protein: sum.protein + Number(e.protein),
      fat: sum.fat + Number(e.fat),
      carbs: sum.carbs + Number(e.carbs),
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );
  const one = (n: number) => Math.round(n * 10) / 10;
  return {
    kcal: Math.round(total.kcal),
    protein: one(total.protein),
    fat: one(total.fat),
    carbs: one(total.carbs),
  };
}

export type DayPoint = { day: string; kcal: number; protein: number };

/** `days` days ending on `endDay`, oldest first; days without entries are 0. */
export function dailySeries(
  entries: ReadonlyArray<{ eaten_on: string; kcal: number; protein: number }>,
  endDay: string,
  days = 7,
): DayPoint[] {
  const end = dayNumber(endDay);
  const points: DayPoint[] = [];
  for (let n = end - days + 1; n <= end; n++) {
    const day = dayFromNumber(n);
    const totals = dayTotals(
      entries
        .filter((e) => e.eaten_on === day)
        .map((e) => ({ kcal: e.kcal, protein: e.protein, fat: 0, carbs: 0 })),
    );
    points.push({ day, kcal: totals.kcal, protein: totals.protein });
  }
  return points;
}

/** Last `limit` distinct items, newest first (input must be newest first). */
export function recentItems<
  T extends { food_id: string | null; recipe_id: string | null; label: string; kcal: number },
>(
  entries: ReadonlyArray<T>,
  limit = 20,
): T[] {
  const seen = new Set<string>();
  const items: T[] = [];
  for (const entry of entries) {
    const key = entry.food_id
      ? `food:${entry.food_id}`
      : entry.recipe_id
        ? `recipe:${entry.recipe_id}`
        : `label:${entry.label.trim().toLowerCase()}|${Math.round(Number(entry.kcal))}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(entry);
    if (items.length >= limit) break;
  }
  return items;
}

/** Slot suggested for the time of day. */
export function defaultSlot(hour: number): MealSlot {
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 17) return "snack";
  if (hour < 22) return "dinner";
  return "snack";
}

export type DailyTargets = {
  energy: EnergyTarget;
  protein: ProteinTarget;
  /** Sum of accepted weekly-review adjustments applied to the calculated target. */
  adjustedBy: number;
};

/**
 * Targets for `day` (§4.2–4.3, 4.5): the latest trend weight up to that day,
 * plus accepted adjustments effective by then. Adjustments change only the
 * calculated target; a target set by the user always wins. Never below the floor.
 */
export function dailyTargets(
  profile: BodyProfileLike | null,
  weighIns: ReadonlyArray<WeighIn>,
  adjustments: ReadonlyArray<{ effective_from: string; delta_kcal: number }>,
  day: string,
): DailyTargets | null {
  if (!profile) return null;
  const trend = trendWeights(weighIns.filter((p) => p.day <= day));
  const weight = trend[trend.length - 1]?.trendKg ?? null;
  const energy = energyTarget(profile, weight, Number(day.slice(0, 4)));
  const protein = proteinTarget(profile, weight);
  const delta = adjustments
    .filter((a) => a.effective_from <= day)
    .reduce((sum, a) => sum + a.delta_kcal, 0);
  if (energy.source !== "calculated" || energy.kcal === null || delta === 0) {
    return { energy, protein, adjustedBy: 0 };
  }
  const sex = profile.sex === "male" || profile.sex === "female" ? profile.sex : null;
  const floor = Math.min(kcalFloor(sex), energy.tdee ?? Infinity, energy.kcal);
  const kcal = Math.max(floor, energy.kcal + delta);
  return { energy: { ...energy, kcal }, protein, adjustedBy: kcal - energy.kcal };
}

export type QuickError = "label" | "kcal" | "protein";

/** Quick-calories form validation, mirroring the table checks. */
export function validateQuick(values: {
  label: string;
  kcal: number;
  protein: number | null;
}): QuickError | null {
  if (!values.label.trim()) return "label";
  if (!Number.isFinite(values.kcal) || values.kcal < 0 || values.kcal > MAX_KCAL) return "kcal";
  if (
    values.protein !== null &&
    (!Number.isFinite(values.protein) || values.protein < 0 || values.protein > MAX_MACRO)
  )
    return "protein";
  return null;
}
