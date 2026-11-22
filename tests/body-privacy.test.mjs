import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

// Body profile and measurements are health data (docs/nutrition-roadmap.md §3):
// never in push payloads, logs, the offline snapshot or the agent snapshot.

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const files = (dir) =>
  readdirSync(new URL(`../${dir}/`, import.meta.url))
    .filter((name) => /\.(ts|tsx|js|mjs)$/.test(name))
    .map((name) => `${dir}/${name}`);

const BODY = /body_(profiles|measurements)|target_adjustments|weight_kg|waist_cm|body_fat|height_cm|lib\/db\/body|weighIn/i;

test("body data stays out of the offline snapshot", () => {
  assert.doesNotMatch(source("src/lib/offlineStore.ts"), BODY);
  assert.doesNotMatch(source("src/lib/offlineStore.ts"), /weight|waist/i);

  const today = source("src/components/today/useTodayState.ts");
  const start = today.indexOf("saveOfflineSnapshot({");
  assert.ok(start > 0, "Today no longer saves an offline snapshot");
  const payload = today.slice(start, today.indexOf("}).catch(", start));
  assert.doesNotMatch(payload, /weigh|weight|waist|body/i);

  // The weigh-in hook may only keep the dismissed day key in localStorage.
  const weighIn = source("src/components/today/useWeighIn.ts");
  assert.doesNotMatch(weighIn, /saveOfflineSnapshot|indexedDB/);
  for (const [, value] of weighIn.matchAll(/localStorage\.setItem\([^,]+,\s*([^)]+)\)/g)) {
    assert.equal(value.trim(), "todayKey");
  }
});

test("body data never reaches push payloads or the service worker", () => {
  for (const path of [
    "src/lib/server/webPush.ts",
    "src/lib/server/reminderDelivery.ts",
    "src/app/api/notifications/send/route.ts",
    "public/sw.js",
    "public/offline.js",
  ]) {
    assert.doesNotMatch(source(path), BODY, path);
  }
});

test("body data never reaches the planning-agent snapshot", () => {
  for (const path of files("src/lib/server/agent")) {
    assert.doesNotMatch(source(path), BODY, path);
  }
});

test("body code never logs and selects explicit columns", () => {
  const paths = [
    "src/lib/db/body.ts",
    "src/lib/nutrition/body.ts",
    "src/components/today/useWeighIn.ts",
    "src/components/today/WeighInSection.tsx",
    "src/app/body/page.tsx",
    "src/app/body/BodyClient.tsx",
    ...files("src/components/body"),
  ];
  for (const path of paths) {
    assert.doesNotMatch(source(path), /console\.|reportError|captureException/, path);
  }
  assert.doesNotMatch(source("src/lib/db/body.ts"), /select\(\s*["']\*["']\s*\)/);
  // Error messages are codes only, never values.
  for (const [, message] of source("src/lib/db/body.ts").matchAll(/new Error\(([^)]*)\)/g)) {
    assert.match(message.trim(), /^"[a-z_]+"$|^\s*error\.code/);
  }
});

test("body tables are exported and cascade with the account", () => {
  const exportRoute = source("src/app/api/account/export/route.ts");
  for (const table of ["body_profiles", "body_measurements", "target_adjustments"]) {
    assert.match(exportRoute, new RegExp(`from\\("${table}"\\)`));
  }
  const migration = source("supabase/migrations/20261122092219_body_profile_and_log.sql");
  assert.equal(
    migration.match(/references auth\.users\(id\) on delete cascade/g)?.length,
    3,
  );
  assert.doesNotMatch(migration, /grant [^;]* to anon/i);
});
