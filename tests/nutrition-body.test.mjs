import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

const body = loadTypeScriptModule(
  new URL("../src/lib/nutrition/body.ts", import.meta.url),
);

const YEAR = 2026;
const base = {
  sex: null,
  birth_year: 1986,
  height_cm: 170,
  activity_level: "light",
  goal_mode: "maintain",
  goal_weight_kg: null,
  goal_rate_kg_week: null,
  kcal_target_override: null,
  protein_mode: "auto",
  protein_grams: null,
};

// Six fixture profiles, values worked out by hand from docs/nutrition-roadmap.md §4.2–4.3.
const fixtures = [
  {
    name: "male, lose 0.5 kg/week",
    // BMR 10·90 + 6.25·180 − 5·40 + 5 = 1830; ×1.55 = 2836.5 → 2840; −550 = 2290.
    // Protein: BMI-25 weight 81 kg (< 90) × 1.2 = 97.2 → 95.
    profile: { ...base, sex: "male", birth_year: 1986, height_cm: 180, activity_level: "moderate", goal_mode: "lose", goal_rate_kg_week: 0.5 },
    weight: 90,
    expected: { tdee: 2840, kcal: 2290, clamped: null, source: "calculated", protein: 95, proteinSource: "calculated" },
  },
  {
    name: "female, lose 1.0 kg/week → deficit capped at 25 %",
    // BMR 700 + 1031.25 − 150 − 161 = 1420.25; ×1.2 = 1704.3 → 1700.
    // Wanted −1100, cap 425 → 1275 → 1280. Protein: goal 60 × 1.2 = 72 → 70.
    profile: { ...base, sex: "female", birth_year: 1996, height_cm: 165, activity_level: "sedentary", goal_mode: "lose", goal_rate_kg_week: 1, goal_weight_kg: 60 },
    weight: 70,
    expected: { tdee: 1700, kcal: 1280, clamped: "deficit", source: "calculated", protein: 70, proteinSource: "calculated" },
  },
  {
    name: "sex not given, maintain → average of both formulas",
    // BMR 750 + 1062.5 − 250 − 78 = 1484.5; ×1.375 = 2041.19 → 2040.
    // Protein: BMI-25 weight 72.25 × 1.2 = 86.7 → 85.
    profile: { ...base, sex: null, birth_year: 1976, height_cm: 170, activity_level: "light", goal_mode: "maintain" },
    weight: 75,
    expected: { tdee: 2040, kcal: 2040, clamped: null, source: "calculated", protein: 85, proteinSource: "calculated" },
  },
  {
    name: "female, lose 0.5 kg/week → 1200 kcal floor",
    // BMR 600 + 987.5 − 275 − 161 = 1151.5; ×1.2 = 1381.8 → 1380.
    // Cap 345 → 1035 < 1200 floor → 1200. Protein: goal 55 × 1.2 = 66 → 65.
    profile: { ...base, sex: "female", birth_year: 1971, height_cm: 158, activity_level: "sedentary", goal_mode: "lose", goal_rate_kg_week: 0.5, goal_weight_kg: 55 },
    weight: 60,
    expected: { tdee: 1380, kcal: 1200, clamped: "floor", source: "calculated", protein: 65, proteinSource: "calculated" },
  },
  {
    name: "male, gain 0.25 kg/week; goal weight above current",
    // BMR 620 + 1093.75 − 125 + 5 = 1593.75; ×1.725 = 2749.2 → 2750; +275 = 3025 → 3030.
    // Protein: goal 68 but never above current 62 → 74.4 → 75.
    profile: { ...base, sex: "male", birth_year: 2001, height_cm: 175, activity_level: "very_active", goal_mode: "gain", goal_rate_kg_week: 0.25, goal_weight_kg: 68 },
    weight: 62,
    expected: { tdee: 2750, kcal: 3030, clamped: null, source: "calculated", protein: 75, proteinSource: "calculated" },
  },
  {
    name: "calorie override and protein limit set by the user win",
    // Calculated TDEE 1855 × 1.55 = 2875.25 → 2880, but override 1900 and limit 60 g win.
    profile: { ...base, sex: "male", birth_year: 1981, height_cm: 172, activity_level: "moderate", goal_mode: "lose", goal_rate_kg_week: 0.5, kcal_target_override: 1900, protein_mode: "limit", protein_grams: 60 },
    weight: 100,
    expected: { tdee: 2880, kcal: 1900, clamped: null, source: "user", protein: 60, proteinSource: "user" },
  },
];

for (const fixture of fixtures) {
  test(`targets: ${fixture.name}`, () => {
    const energy = body.energyTarget(fixture.profile, fixture.weight, YEAR);
    assert.equal(energy.tdee, fixture.expected.tdee);
    assert.equal(energy.kcal, fixture.expected.kcal);
    assert.equal(energy.clamped, fixture.expected.clamped);
    assert.equal(energy.source, fixture.expected.source);
    const protein = body.proteinTarget(fixture.profile, fixture.weight);
    assert.equal(protein.grams, fixture.expected.protein);
    assert.equal(protein.source, fixture.expected.proteinSource);
  });
}

test("custom protein target is user-set; auto ignores stored grams", () => {
  const custom = body.proteinTarget({ ...base, protein_mode: "custom", protein_grams: 140 }, 80);
  assert.deepEqual({ ...custom }, { grams: 140, mode: "custom", source: "user" });
  const auto = body.proteinTarget({ ...base, protein_grams: 140 }, 80);
  assert.equal(auto.mode, "auto");
  assert.equal(auto.source, "calculated");
});

test("no weight yet: no calculated calorie target, override still applies", () => {
  assert.equal(body.energyTarget(base, null, YEAR).kcal, null);
  const override = body.energyTarget({ ...base, kcal_target_override: 1800 }, null, YEAR);
  assert.equal(override.kcal, 1800);
  assert.equal(override.source, "user");
});

test("limit mode turns amber above 90 % only", () => {
  const limit = { grams: 60, mode: "limit", source: "user" };
  assert.equal(body.proteinBarState(54, limit), "normal");
  assert.equal(body.proteinBarState(54.5, limit), "amber");
  assert.equal(body.proteinBarState(100, { grams: 60, mode: "auto", source: "calculated" }), "normal");
});

test("BMI and waist-to-height round and band as specified", () => {
  assert.equal(body.bmi(90, 180), 27.8);
  assert.equal(body.bmi(60, 165), 22);
  assert.equal(body.waistToHeight(84, 170), 0.49);
  assert.equal(body.waistBand(0.49), "healthy");
  assert.equal(body.waistBand(0.5), "increased");
  assert.equal(body.waistBand(0.59), "increased");
  assert.equal(body.waistBand(0.6), "high");
});

test("trend weight is an EWMA with alpha 0.25 that skips missing days", () => {
  const trend = body.trendWeights([
    { day: "2026-11-03", weightKg: 82 },
    { day: "2026-11-01", weightKg: 80 },
    { day: "2026-11-07", weightKg: 78 },
  ]);
  assert.deepEqual(trend.map((point) => point.day), ["2026-11-01", "2026-11-03", "2026-11-07"]);
  assert.equal(trend[0].trendKg, 80);
  assert.equal(trend[1].trendKg, 80.5);
  assert.equal(trend[2].trendKg, 79.875);
});

test("7-day average and weekly averages follow the week start", () => {
  const points = [
    { day: "2026-11-14", weightKg: 79 }, // Saturday
    { day: "2026-11-16", weightKg: 80 }, // Monday
    { day: "2026-11-20", weightKg: 81 }, // Friday
    { day: "2026-11-21", weightKg: 82 }, // Saturday
  ];
  assert.equal(body.sevenDayAverage(points, "2026-11-21"), 81);
  assert.equal(body.sevenDayAverage(points, "2026-11-01"), null);
  // Saturday start (fa default): weeks start Sat 14 (14, 16, 20) and Sat 21.
  assert.deepEqual(
    body.weeklyAverages(points, 6).map((w) => [w.weekStart, w.averageKg]),
    [["2026-11-14", 80], ["2026-11-21", 82]],
  );
  // Monday start (en default).
  assert.deepEqual(
    body.weeklyAverages(points, 1).map((w) => [w.weekStart, w.averageKg]),
    [["2026-11-09", 79], ["2026-11-16", 81]],
  );
  assert.equal(body.defaultWeekStart("fa"), 6);
  assert.equal(body.defaultWeekStart("en"), 1);
});

test("observed rate needs 8 weigh-ins over 14+ days", () => {
  const steady = (count, everyDays) =>
    Array.from({ length: count }, (_, i) => ({
      day: body.dayFromNumber(body.dayNumber("2026-11-21") - (count - 1 - i) * everyDays),
      weightKg: 90 - (i * everyDays * 0.5) / 7, // −0.5 kg/week
    }));
  assert.equal(body.observedRate(steady(7, 3), "2026-11-21"), null, "too few weigh-ins");
  assert.equal(body.observedRate(steady(10, 1), "2026-11-21"), null, "span under 14 days");
  assert.equal(body.observedRate(steady(10, 2), "2026-11-21"), -0.5);
  // Weigh-ins older than 28 days are ignored.
  const withOld = [{ day: "2026-09-01", weightKg: 120 }, ...steady(10, 2)];
  assert.equal(body.observedRate(withOld, "2026-11-21"), -0.5);
});

test("typed numbers accept Persian digits and decimal marks", () => {
  assert.equal(body.parseDecimal("۷۲٫۵"), 72.5);
  assert.equal(body.parseDecimal("٧٠"), 70);
  assert.equal(body.parseDecimal(" 81,4 "), 81.4);
  assert.equal(body.parseDecimal(""), null);
  assert.ok(Number.isNaN(body.parseDecimal("8o")));
  assert.ok(Number.isNaN(body.parseDecimal("-5")));
});

test("latest weight picks the newest day", () => {
  assert.deepEqual(
    { ...body.latestWeight([{ day: "2026-11-02", weightKg: 81 }, { day: "2026-11-01", weightKg: 80 }]) },
    { day: "2026-11-02", weightKg: 81 },
  );
  assert.equal(body.latestWeight([]), null);
});
