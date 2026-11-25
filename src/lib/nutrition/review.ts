/**
 * Weekly review (docs/nutrition-roadmap.md S7c, §4.5). Pure, unit-tested.
 */
import {
  bmi,
  dayFromNumber,
  dayNumber,
  kcalFloor,
  observedRate,
  trendWeights,
  weekStart,
  type BodyProfileLike,
  type WeighIn,
} from "./body";
import { dailyTargets } from "./log";

export const ADJUSTMENT_KCAL = 150;
export const SUGGESTED_STEPS = 2000;
export const ADJUSTMENT_COOLDOWN_DAYS = 14;
const SLOW_RATE = 0.3;
const FAST_RATE = 1;
const FAST_RATE_MIN_SPAN_DAYS = 21;
const MIN_BMI_TO_LOWER = 18.5;
const DEFAULT_GOAL_RATE = 0.5;
/** Limit of `target_adjustments.delta_kcal`. */
const MAX_DELTA = 1000;

/** The last completed week before the one containing `today`. */
export function reviewWeek(today: string, weekStartsOn: number): { start: string; end: string } {
  const start = dayNumber(weekStart(today, weekStartsOn)) - 7;
  return { start: dayFromNumber(start), end: dayFromNumber(start + 6) };
}

/** Averages over days that have at least one entry; null when nothing was logged. */
export function loggedAverages(
  entries: ReadonlyArray<{ eaten_on: string; kcal: number; protein: number }>,
): { days: number; kcal: number; protein: number } | null {
  const days = new Set(entries.map((entry) => entry.eaten_on)).size;
  if (days === 0) return null;
  const sum = (pick: (entry: { kcal: number; protein: number }) => number) =>
    entries.reduce((total, entry) => total + pick(entry), 0);
  return {
    days,
    kcal: Math.round(sum((entry) => entry.kcal) / days),
    protein: Math.round(sum((entry) => entry.protein) / days),
  };
}

/** Trend weight at the end of the week and how it moved during it. */
export function weekTrend(
  weighIns: readonly WeighIn[],
  week: { start: string; end: string },
): { trendKg: number; changeKg: number | null } | null {
  const trend = trendWeights(weighIns.filter((point) => point.day <= week.end));
  const last = trend[trend.length - 1];
  if (!last) return null;
  const before = trend.filter((point) => point.day < week.start).pop();
  const weighedThisWeek = last.day >= week.start;
  return {
    trendKg: last.trendKg,
    changeKg: before && weighedThisWeek ? last.trendKg - before.trendKg : null,
  };
}

export type Adjustment = { effective_from: string; delta_kcal: number };

export type Suggestion = {
  /** `none`: no calorie suggestion applies (not losing, or target set by you). */
  kind: "none" | "not_enough" | "recent" | "keep" | "done" | "lower" | "steps" | "raise";
  /** kcal change that Accept stores; 0 when there is nothing to accept. */
  deltaKcal: number;
};

const nothing = (kind: Suggestion["kind"]): Suggestion => ({ kind, deltaKcal: 0 });

/**
 * Earlier cuts can add up to less than the floor, which would swallow a raise.
 * Fill that gap too, so the target the user sees really goes up by 150.
 */
function raiseDelta(
  profile: BodyProfileLike,
  points: readonly WeighIn[],
  adjustments: readonly Adjustment[],
  today: string,
): number {
  const base = dailyTargets(profile, points, [], today)?.energy.kcal ?? null;
  const effective = dailyTargets(profile, points, adjustments, today)?.energy.kcal ?? null;
  if (base === null || effective === null) return ADJUSTMENT_KCAL;
  const stored = adjustments
    .filter((item) => item.effective_from <= today)
    .reduce((sum, item) => sum + item.delta_kcal, 0);
  return Math.min(MAX_DELTA, ADJUSTMENT_KCAL + Math.max(0, effective - (base + stored)));
}

/** §4.5. Never applied automatically; the user accepts or dismisses. */
export function weeklySuggestion(
  profile: BodyProfileLike | null,
  weighIns: readonly WeighIn[],
  adjustments: readonly Adjustment[],
  today: string,
): Suggestion {
  if (!profile || profile.goal_mode !== "lose" || profile.kcal_target_override !== null) {
    return nothing("none");
  }
  const points = weighIns.filter((point) => point.day <= today);
  const rate = observedRate(points, today);
  if (rate === null) return nothing("not_enough");

  const now = dayNumber(today);
  if (
    adjustments.some((item) => dayNumber(item.effective_from) > now - ADJUSTMENT_COOLDOWN_DAYS)
  ) {
    return nothing("recent");
  }

  const loss = -rate;
  if (loss > FAST_RATE) {
    const numbers = points.map((point) => dayNumber(point.day));
    const span = Math.max(...numbers) - Math.min(...numbers);
    if (span >= FAST_RATE_MIN_SPAN_DAYS) {
      return { kind: "raise", deltaKcal: raiseDelta(profile, points, adjustments, today) };
    }
  }

  const trend = trendWeights(points);
  const weight = trend[trend.length - 1]?.trendKg;
  if (weight === undefined) return nothing("not_enough");
  const reachedGoal = profile.goal_weight_kg !== null && weight <= profile.goal_weight_kg;
  if (reachedGoal || bmi(weight, profile.height_cm) < MIN_BMI_TO_LOWER) return nothing("done");

  // A slower chosen goal must not be reported as "too slow" when it is on track.
  const goalRate = profile.goal_rate_kg_week ?? DEFAULT_GOAL_RATE;
  if (loss >= Math.min(SLOW_RATE, goalRate * 0.8)) return nothing("keep");

  const target = dailyTargets(profile, points, adjustments, today)?.energy.kcal ?? null;
  const sex = profile.sex === "male" || profile.sex === "female" ? profile.sex : null;
  return target !== null && target - ADJUSTMENT_KCAL >= kcalFloor(sex)
    ? { kind: "lower", deltaKcal: -ADJUSTMENT_KCAL }
    : nothing("steps");
}
