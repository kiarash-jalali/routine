/**
 * Body metrics, energy and protein targets (docs/nutrition-roadmap.md §4.1–4.3).
 * Pure functions shared by UI and server; no formulas elsewhere.
 * Body values are health data: never log or send them anywhere from here.
 */

export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "very_active";
export type GoalMode = "lose" | "maintain" | "gain";
export type ProteinMode = "auto" | "limit" | "custom";
export type WaistBand = "healthy" | "increased" | "high";

/** The body_profiles columns the calculations need (snake_case, like the row). */
export type BodyProfileLike = {
  sex: string | null;
  birth_year: number;
  height_cm: number;
  activity_level: string;
  goal_mode: string;
  goal_weight_kg: number | null;
  goal_rate_kg_week: number | null;
  kcal_target_override: number | null;
  protein_mode: string;
  protein_grams: number | null;
};

export type WeighIn = { day: string; weightKg: number };

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
};
export const LOSE_RATES = [0.25, 0.5, 0.75, 1] as const;
export const GAIN_RATES = [0.25, 0.5] as const;
export const KCAL_PER_KG = 7700;
export const TREND_ALPHA = 0.25;
const DEFAULT_LOSE_RATE = 0.5;
const DEFAULT_GAIN_RATE = 0.25;
const MAX_DEFICIT_SHARE = 0.25;
const KCAL_FLOOR = { male: 1500, female: 1200, unspecified: 1350 } as const;
const AUTO_PROTEIN_G_PER_KG = 1.2;
const REFERENCE_BMI = 25;
const DAY_MS = 86_400_000;

const roundTo = (value: number, step: number) => Math.round(value / step) * step;
const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

function asSex(value: string | null): Sex | null {
  return value === "male" || value === "female" ? value : null;
}
function asActivity(value: string): ActivityLevel {
  return value in ACTIVITY_MULTIPLIERS ? (value as ActivityLevel) : "light";
}

/** "YYYY-MM-DD" → whole days since the epoch (UTC, so no DST drift). */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / DAY_MS);
}
export function dayFromNumber(value: number): string {
  return new Date(value * DAY_MS).toISOString().slice(0, 10);
}

// ---------- 4.1 Body metrics ----------

/** weight / height², one decimal. */
export function bmi(weightKg: number, heightCm: number): number {
  const metres = heightCm / 100;
  return round1(weightKg / (metres * metres));
}

/** waist / height, two decimals. */
export function waistToHeight(waistCm: number, heightCm: number): number {
  return round2(waistCm / heightCm);
}

/** Informational bands: < 0.5 healthy, 0.5–0.6 increased, ≥ 0.6 high. */
export function waistBand(ratio: number): WaistBand {
  if (ratio < 0.5) return "healthy";
  if (ratio < 0.6) return "increased";
  return "high";
}

function sortedWeighIns(points: WeighIn[]): WeighIn[] {
  return points
    .filter((point) => Number.isFinite(point.weightKg))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/** EWMA (α = 0.25) of weigh-ins in date order; missing days are skipped. */
export function trendWeights(
  points: WeighIn[],
): Array<WeighIn & { trendKg: number }> {
  let trend: number | null = null;
  return sortedWeighIns(points).map((point) => {
    trend =
      trend === null ? point.weightKg : trend + TREND_ALPHA * (point.weightKg - trend);
    return { ...point, trendKg: trend };
  });
}

/** Plain average of weigh-ins in the 7 days ending on `endDay`; null if none. */
export function sevenDayAverage(points: WeighIn[], endDay: string): number | null {
  const end = dayNumber(endDay);
  const inWindow = points.filter((point) => {
    const day = dayNumber(point.day);
    return day <= end && day > end - 7;
  });
  if (!inWindow.length) return null;
  return inWindow.reduce((sum, point) => sum + point.weightKg, 0) / inWindow.length;
}

/** Start of the week containing `day`; weekStartsOn uses 0 = Sunday … 6 = Saturday. */
export function weekStart(day: string, weekStartsOn: number): string {
  const value = dayNumber(day);
  const weekday = new Date(value * DAY_MS).getUTCDay();
  return dayFromNumber(value - ((weekday - weekStartsOn + 7) % 7));
}

/** Average weight per week (weeks start on weekStartsOn), oldest first. */
export function weeklyAverages(
  points: WeighIn[],
  weekStartsOn: number,
): Array<{ weekStart: string; averageKg: number; count: number }> {
  const weeks = new Map<string, { sum: number; count: number }>();
  for (const point of sortedWeighIns(points)) {
    const key = weekStart(point.day, weekStartsOn);
    const week = weeks.get(key) ?? { sum: 0, count: 0 };
    week.sum += point.weightKg;
    week.count += 1;
    weeks.set(key, week);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, week]) => ({
      weekStart: key,
      averageKg: week.sum / week.count,
      count: week.count,
    }));
}

export const OBSERVED_RATE_WINDOW_DAYS = 28;
export const OBSERVED_RATE_MIN_WEIGH_INS = 8;
export const OBSERVED_RATE_MIN_SPAN_DAYS = 14;

/**
 * kg/week from a least-squares line through the last 28 days of weigh-ins.
 * Negative means losing. Null ("not enough data yet") unless there are at
 * least 8 weigh-ins spanning 14+ days.
 */
export function observedRate(points: WeighIn[], today: string): number | null {
  const end = dayNumber(today);
  const recent = sortedWeighIns(points)
    .map((point) => ({ x: dayNumber(point.day), y: point.weightKg }))
    .filter((point) => point.x <= end && point.x > end - OBSERVED_RATE_WINDOW_DAYS);
  if (recent.length < OBSERVED_RATE_MIN_WEIGH_INS) return null;
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (!first || !last || last.x - first.x < OBSERVED_RATE_MIN_SPAN_DAYS) return null;

  const n = recent.length;
  const meanX = recent.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = recent.reduce((sum, p) => sum + p.y, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (const p of recent) {
    numerator += (p.x - meanX) * (p.y - meanY);
    denominator += (p.x - meanX) ** 2;
  }
  if (denominator === 0) return null;
  return round2((numerator / denominator) * 7);
}

// ---------- 4.2 Energy target ----------

export function ageFromBirthYear(birthYear: number, currentYear: number): number {
  return currentYear - birthYear;
}

/** Mifflin–St Jeor. Unspecified sex uses the average of both formulas. */
export function bmr(
  sex: Sex | null,
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === "male") return base + 5;
  if (sex === "female") return base - 161;
  return base + (5 - 161) / 2;
}

/** BMR × activity multiplier, rounded to 10 kcal. */
export function tdee(bmrValue: number, activity: ActivityLevel): number {
  return roundTo(bmrValue * ACTIVITY_MULTIPLIERS[activity], 10);
}

export function kcalFloor(sex: Sex | null): number {
  return sex ? KCAL_FLOOR[sex] : KCAL_FLOOR.unspecified;
}

export type EnergyTarget = {
  /** Daily target in kcal; null when there is no weight yet and no override. */
  kcal: number | null;
  tdee: number | null;
  source: "calculated" | "user";
  /** Why the calculated target was capped ("we capped this to keep it safe"). */
  clamped: null | "deficit" | "floor";
};

export function energyTarget(
  profile: BodyProfileLike,
  weightKg: number | null,
  currentYear: number,
): EnergyTarget {
  const sex = asSex(profile.sex);
  const maintenance =
    weightKg === null
      ? null
      : tdee(
          bmr(
            sex,
            weightKg,
            profile.height_cm,
            ageFromBirthYear(profile.birth_year, currentYear),
          ),
          asActivity(profile.activity_level),
        );

  if (profile.kcal_target_override !== null) {
    return {
      kcal: profile.kcal_target_override,
      tdee: maintenance,
      source: "user",
      clamped: null,
    };
  }
  if (maintenance === null) {
    return { kcal: null, tdee: null, source: "calculated", clamped: null };
  }

  if (profile.goal_mode === "lose") {
    const rate = profile.goal_rate_kg_week ?? DEFAULT_LOSE_RATE;
    let deficit = (rate * KCAL_PER_KG) / 7;
    let clamped: EnergyTarget["clamped"] = null;
    const maxDeficit = maintenance * MAX_DEFICIT_SHARE;
    if (deficit > maxDeficit) {
      deficit = maxDeficit;
      clamped = "deficit";
    }
    let target = maintenance - deficit;
    // Never below the floor, and never above maintenance because of it.
    const floor = Math.min(kcalFloor(sex), maintenance);
    if (target < floor) {
      target = floor;
      clamped = "floor";
    }
    return { kcal: roundTo(target, 10), tdee: maintenance, source: "calculated", clamped };
  }
  if (profile.goal_mode === "gain") {
    const rate = profile.goal_rate_kg_week ?? DEFAULT_GAIN_RATE;
    return {
      kcal: roundTo(maintenance + (rate * KCAL_PER_KG) / 7, 10),
      tdee: maintenance,
      source: "calculated",
      clamped: null,
    };
  }
  return { kcal: maintenance, tdee: maintenance, source: "calculated", clamped: null };
}

// ---------- 4.3 Protein ----------

/** Weight at BMI 25 for this height. */
export function weightAtBmi(heightCm: number, targetBmi = REFERENCE_BMI): number {
  const metres = heightCm / 100;
  return targetBmi * metres * metres;
}

/** Goal weight if set, else the BMI-25 weight; never above current weight. */
export function referenceWeight(
  heightCm: number,
  currentWeightKg: number | null,
  goalWeightKg: number | null,
): number {
  const reference = goalWeightKg ?? weightAtBmi(heightCm);
  return currentWeightKg === null ? reference : Math.min(reference, currentWeightKg);
}

export type ProteinTarget = {
  grams: number;
  mode: ProteinMode;
  source: "calculated" | "user";
};

export function proteinTarget(
  profile: BodyProfileLike,
  currentWeightKg: number | null,
): ProteinTarget {
  if (
    (profile.protein_mode === "limit" || profile.protein_mode === "custom") &&
    profile.protein_grams !== null
  ) {
    return { grams: profile.protein_grams, mode: profile.protein_mode, source: "user" };
  }
  const reference = referenceWeight(
    profile.height_cm,
    currentWeightKg,
    profile.goal_weight_kg,
  );
  return {
    grams: roundTo(AUTO_PROTEIN_G_PER_KG * reference, 5),
    mode: "auto",
    source: "calculated",
  };
}

/** Limit mode turns the bar amber above 90 % of the limit. */
export function proteinBarState(
  eatenGrams: number,
  target: ProteinTarget,
): "normal" | "amber" {
  return target.mode === "limit" && eatenGrams > target.grams * 0.9
    ? "amber"
    : "normal";
}

// ---------- Helpers for screens ----------

/** Latest non-null weight, by date. */
export function latestWeight(points: WeighIn[]): WeighIn | null {
  const sorted = sortedWeighIns(points);
  return sorted[sorted.length - 1] ?? null;
}

/**
 * Reads a typed number, accepting Persian/Arabic digits and "٫" or "," as the
 * decimal mark. Empty → null; anything else that isn't a number → NaN.
 */
export function parseDecimal(text: string): number | null {
  const normalized = text
    .trim()
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[٫,]/g, ".");
  if (!normalized) return null;
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

/** Default week start for a language: Saturday for fa, Monday for en. */
export function defaultWeekStart(language: string): number {
  return language === "fa" ? 6 : 1;
}
