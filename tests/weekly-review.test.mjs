import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const load = (name, mocks) =>
  loadTypeScriptModule(new URL(`../src/lib/nutrition/${name}.ts`, import.meta.url), mocks);
const food = load("food");
const body = load("body");
const log = load("log", { "./food": food, "./body": body });
const review = load("review", { "./body": body, "./log": log });
const plain = (value) => JSON.parse(JSON.stringify(value));

const TODAY = "2026-11-28";
const profile = {
  sex: "male",
  birth_year: 1990,
  height_cm: 180,
  activity_level: "moderate",
  goal_mode: "lose",
  goal_weight_kg: 80,
  goal_rate_kg_week: 0.5,
  kcal_target_override: null,
  protein_mode: "auto",
  protein_grams: null,
};

/** One weigh-in a day for `days` days, losing `rate` kg per week, ending today. */
function series(rate, { days = 28, end = 95 } = {}) {
  const last = body.dayNumber(TODAY);
  return Array.from({ length: days }, (_, i) => ({
    day: body.dayFromNumber(last - (days - 1 - i)),
    weightKg: end + (rate / 7) * (days - 1 - i),
  }));
}
const suggest = (rate, changes = {}, options = {}, adjustments = []) =>
  plain(review.weeklySuggestion({ ...profile, ...changes }, series(rate, options), adjustments, TODAY));

test("table 4.5: slow, on-track and fast loss", () => {
  assert.deepEqual(suggest(0.1), { kind: "lower", deltaKcal: -150 });
  assert.deepEqual(suggest(-0.2), { kind: "lower", deltaKcal: -150 });
  for (const rate of [0.32, 0.5, 0.98]) assert.equal(suggest(rate).kind, "keep");
  assert.deepEqual(suggest(1.3), { kind: "raise", deltaKcal: 150 });
  assert.equal(suggest(1.3, {}, { days: 18 }).kind, "keep", "first three weeks are not judged");
});

test("a slower chosen goal that is on track is never called too slow", () => {
  assert.equal(suggest(0.25, { goal_rate_kg_week: 0.25 }).kind, "keep");
  assert.equal(suggest(0.1, { goal_rate_kg_week: 0.25 }).kind, "lower");
});

test("never suggests eating less below the floor, at the goal or at a low BMI", () => {
  // 155 cm, 55 kg, sedentary: the calculated target is already at the floor.
  const small = { sex: "female", height_cm: 155, birth_year: 1970, activity_level: "sedentary", goal_weight_kg: 50 };
  assert.equal(suggest(0, small, { end: 55 }).kind, "steps");
  assert.equal(suggest(0, {}, { end: 79 }).kind, "done");
  assert.equal(suggest(0.5, {}, { end: 79 }).kind, "done", "not told to keep losing");
  assert.equal(suggest(0, { goal_weight_kg: null }, { end: 58 }).kind, "done");
  assert.equal(suggest(1.3, {}, { end: 79 }).kind, "raise", "fast loss still gets more food");
});

test("a raise is never swallowed by the calorie floor", () => {
  const adjustments = [{ effective_from: "2026-10-01", delta_kcal: -1000 }];
  const points = series(1.3);
  const kcal = (list) => log.dailyTargets(profile, points, list, TODAY).energy.kcal;
  const before = kcal(adjustments);
  const { kind, deltaKcal } = review.weeklySuggestion(profile, points, adjustments, TODAY);
  assert.equal(kind, "raise");
  assert.ok(deltaKcal > 150, "the fixture must reach the floor");
  assert.equal(kcal([...adjustments, { effective_from: TODAY, delta_kcal: deltaKcal }]), before + 150);
});

test("no suggestion without data, for other modes, own targets or right after a change", () => {
  assert.equal(suggest(0.1, {}, { days: 7 }).kind, "not_enough");
  assert.equal(suggest(0.1, { goal_mode: "gain" }).kind, "none");
  assert.equal(suggest(0.1, { goal_mode: "maintain" }).kind, "none");
  assert.equal(suggest(0.1, { kcal_target_override: 1800 }).kind, "none");
  assert.equal(review.weeklySuggestion(null, [], [], TODAY).kind, "none");
  const change = (day) => [{ effective_from: day, delta_kcal: -150 }];
  assert.equal(suggest(0.1, {}, {}, change("2026-11-20")).kind, "recent");
  assert.equal(suggest(0.1, {}, {}, change("2026-11-01")).kind, "lower");
});

test("review covers the last completed week for any week start", () => {
  assert.deepEqual(plain(review.reviewWeek("2026-11-28", 6)), { start: "2026-11-21", end: "2026-11-27" });
  assert.deepEqual(plain(review.reviewWeek("2026-11-28", 1)), { start: "2026-11-16", end: "2026-11-22" });
});

test("averages use logged days only and the trend needs a weigh-in that week", () => {
  assert.equal(review.loggedAverages([]), null);
  assert.deepEqual(
    plain(
      review.loggedAverages([
        { eaten_on: "2026-11-21", kcal: 1000, protein: 60 },
        { eaten_on: "2026-11-21", kcal: 800, protein: 40 },
        { eaten_on: "2026-11-23", kcal: 2200, protein: 120 },
      ]),
    ),
    { days: 2, kcal: 2000, protein: 110 },
  );
  const week = { start: "2026-11-21", end: "2026-11-27" };
  const old = [{ day: "2026-11-10", weightKg: 90 }];
  assert.equal(review.weekTrend([], week), null);
  assert.equal(review.weekTrend(old, week).changeKg, null);
  assert.ok(review.weekTrend([...old, { day: "2026-11-22", weightKg: 88 }], week).changeKg < 0);
});

test("review data stays out of push, the service worker, offline and agent code, and logs", () => {
  for (const path of [
    "src/lib/server/webPush.ts",
    "src/app/api/notifications/send/route.ts",
    "src/lib/offlineStore.ts",
    "public/sw.js",
    "public/offline.js",
  ]) {
    assert.doesNotMatch(source(path), /review_dismissals|lib\/db\/review|weeklySuggestion/, path);
  }
  for (const path of ["src/lib/db/review.ts", "src/app/review/page.tsx", "src/app/review/ReviewClient.tsx"]) {
    assert.doesNotMatch(source(path), /console\.|localStorage/, path);
  }
  assert.match(source("src/proxy.ts"), /"\/review"/);
  assert.match(source("src/components/AppFrame.tsx"), /"\/review"/);
});
