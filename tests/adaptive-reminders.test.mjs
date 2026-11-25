import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const adaptive = loadTypeScriptModule(new URL("../src/lib/adaptiveReminders.ts", import.meta.url));
const migration = source("supabase/migrations/20261125121754_adaptive_reminders.sql");

test("quiet mode needs five unopened days and one open clears it", () => {
  const unopened = Array(5).fill(false);
  assert.equal(adaptive.isQuiet(unopened), true);
  assert.equal(adaptive.isQuiet(unopened.slice(1)), false);
  assert.equal(adaptive.isQuiet([]), false);
  for (let index = 0; index < 5; index += 1) {
    assert.equal(adaptive.isQuiet(unopened.map((_, day) => day === index)), false);
  }
});

test("quiet daily categories send every other day, also across a month end", () => {
  const days = ["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"];
  for (const category of ["checkin", "routine"]) {
    const sends = days.map((day) => adaptive.sendsToday(category, true, day));
    for (let i = 1; i < sends.length; i += 1) assert.notEqual(sends[i], sends[i - 1]);
    for (const day of days) assert.equal(adaptive.sendsToday(category, false, day), true);
  }
});

test("health, tasks, workouts and weekly reminders are never thinned", () => {
  for (const category of ["health", "task", "workout", "meal_plan", "grocery"]) {
    for (const day of ["2026-11-29", "2026-11-30"]) {
      assert.equal(adaptive.sendsToday(category, true, day), true);
    }
  }
  const sender = source("src/app/api/notifications/send/route.ts");
  for (const [, category] of sender.matchAll(/sendsToday\(\s*"(\w+)"/g)) {
    assert.ok(["checkin", "routine"].includes(category), category);
  }
});

test("every event key the sender builds maps to a Settings category", () => {
  const sender = source("src/app/api/notifications/send/route.ts");
  const prefixes = new Set([...sender.matchAll(/`([a-z-]+):\$\{/g)].map((match) => match[1]));
  assert.ok(prefixes.size >= 7);
  for (const prefix of prefixes) {
    const mapped = migration.match(new RegExp(`when '${prefix}' then '(\\w+)'`))?.[1];
    assert.ok(mapped && adaptive.isAdaptiveCategory(mapped), `unmapped key ${prefix}`);
  }
});

test("deliveries are kept long enough for five weekly reminders", () => {
  const days = source("src/app/api/notifications/send/route.ts").match(/DELIVERY_RETENTION_DAYS = (\d+)/)?.[1];
  assert.ok(Number(days) >= 43);
});

test("activity is readable by the service role only and changes no payload", () => {
  assert.match(migration, /revoke all on function public\.reminder_recent_days[^;]+from public, anon, authenticated/);
  assert.match(source("src/lib/server/reminderActivity.ts"), /import "server-only"/);
  assert.doesNotMatch(source("src/lib/server/webPush.ts"), /quiet|adaptive/i);
});
