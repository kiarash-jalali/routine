import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

// Food log entries are health data (diet; docs/nutrition-roadmap.md §3):
// never in push payloads, logs, the offline snapshot or the agent snapshot.

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const files = (dir) =>
  readdirSync(new URL(`../${dir}/`, import.meta.url))
    .filter((name) => /\.(ts|tsx|js|mjs)$/.test(name))
    .map((name) => `${dir}/${name}`);

const FOOD_LOG = /food_log|foodLog|lib\/db\/foodLog|useFoodToday|eaten_on/i;
const MIGRATION = "supabase/migrations/20261122182538_food_log_entries.sql";

test("food log stays out of the offline snapshot and browser storage", () => {
  assert.doesNotMatch(source("src/lib/offlineStore.ts"), FOOD_LOG);
  const today = source("src/components/today/useTodayState.ts");
  const start = today.indexOf("saveOfflineSnapshot({");
  assert.ok(start > 0, "Today no longer saves an offline snapshot");
  const payload = today.slice(start, today.indexOf("}).catch(", start));
  assert.doesNotMatch(payload, /food|kcal|protein|meal/i);

  for (const path of ["src/components/today/useFoodToday.ts", "src/components/food/LogTab.tsx", "src/components/food/QuickAddSheet.tsx"]) {
    assert.doesNotMatch(source(path), /saveOfflineSnapshot|indexedDB|localStorage|sessionStorage/, path);
  }
});

test("food log never reaches push payloads or the service worker", () => {
  for (const path of [
    "src/lib/server/webPush.ts",
    "src/lib/server/reminderDelivery.ts",
    "src/app/api/notifications/send/route.ts",
    "public/sw.js",
    "public/offline.js",
  ]) {
    assert.doesNotMatch(source(path), FOOD_LOG, path);
  }
});

test("food log never reaches the planning-agent snapshot", () => {
  for (const path of files("src/lib/server/agent")) {
    assert.doesNotMatch(source(path), FOOD_LOG, path);
  }
});

test("food log code never logs and selects explicit columns", () => {
  const paths = [
    "src/lib/db/foodLog.ts",
    "src/lib/nutrition/log.ts",
    "src/components/today/useFoodToday.ts",
    "src/components/today/MealsSection.tsx",
    "src/components/food/LogTab.tsx",
    "src/components/food/LogTotals.tsx",
    "src/components/food/QuickAddSheet.tsx",
    "src/components/food/WeekChart.tsx",
  ];
  for (const path of paths) {
    assert.doesNotMatch(source(path), /console\.|reportError|captureException/, path);
  }
  const db = source("src/lib/db/foodLog.ts");
  assert.doesNotMatch(db, /select\(\s*["']\*["']\s*\)/);
  for (const [, message] of db.matchAll(/new Error\(([^)]*)\)/g)) {
    assert.match(message.trim(), /^"[a-z_]+"$/);
  }
});

test("food log is exported, cascades with the account and has no anon grant", () => {
  assert.match(source("src/app/api/account/export/route.ts"), /from\("food_log_entries"\)/);
  const migration = source(MIGRATION);
  assert.match(migration, /user_id uuid not null references auth\.users\(id\) on delete cascade/);
  assert.match(migration, /enable row level security/);
  assert.doesNotMatch(migration, /grant [^;]* to anon/i);
  // Deleting a food or recipe keeps the snapshot entry.
  assert.match(migration, /references public\.recipes\(id\) on delete set null/);
  assert.match(migration, /references public\.foods\(id\) on delete set null/);
});
