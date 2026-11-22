import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("push payload adds only the event key and category for open tracking", () => {
  const push = source("src/lib/server/webPush.ts");
  const payload = push.slice(push.indexOf("JSON.stringify({"), push.indexOf("}),", push.indexOf("JSON.stringify({")));
  assert.match(payload, /event: eventKey/);
  assert.match(payload, /category/);
  assert.doesNotMatch(payload, /dose|medication|note|endpoint/i);
});

test("service worker reports opens best-effort and keeps the URL allowlist", () => {
  const worker = source("public/sw.js");
  assert.match(worker, /\/api\/notifications\/opened/);
  assert.match(worker, /event\.waitUntil\(reportNotificationOpened\(event\.notification\.data\)\)/);
  assert.match(worker, /\["\/dashboard", "\/checkin", "\/health", "\/workouts"\]\.includes/);
});

test("opened route authenticates, rate-limits and only updates the user's own delivery", () => {
  const route = source("src/app/api/notifications/opened/route.ts");
  assert.match(route, /getClaims\(\)/);
  assert.match(route, /enforceRateLimit\(admin, "notification-opened"/);
  assert.match(route, /isValidPushEndpoint\(endpoint\)/);
  assert.match(route, /\.eq\("user_id", userId\)\s*\.eq\("endpoint", endpoint\)/);
  assert.match(route, /\.is\("opened_at", null\)/);
  assert.doesNotMatch(route, /console\./);
  const migration = source("supabase/migrations/20261121202801_push_delivery_opened_at.sql");
  assert.match(migration, /add column if not exists opened_at timestamptz/);
  assert.doesNotMatch(migration, /grant .* to authenticated/i);
});

test("opened route accepts every event key the sender builds", () => {
  const route = source("src/app/api/notifications/opened/route.ts");
  const match = route.match(/const EVENT_KEY = \/(.+)\/;/);
  assert.ok(match, "EVENT_KEY pattern not found");
  const eventKey = new RegExp(match[1]);
  const id = "3f6c2a9e-1b2d-4c5e-8f90-123456789abc";
  const keys = [
    "checkin:2026-11-22:08:00",
    "checkin-missed:2026-11-21",
    `task:${id}`,
    `routine:${id}:2026-11-22`,
    `health:${id}:2026-11-22T08:05:00.000Z`,
    `health:${id}`,
    `workout:${id}`,
  ];
  for (const key of keys) assert.ok(eventKey.test(key), `rejected ${key}`);
  for (const bad of ["", "CHECKIN:x", "task:", "task:<script>", `task:${"a".repeat(191)}`]) {
    assert.ok(!eventKey.test(bad), `accepted ${bad}`);
  }
  // Every key template in the sender uses a prefix the pattern allows.
  const sender = source("src/app/api/notifications/send/route.ts");
  const prefixes = [...sender.matchAll(/`([a-z-]+):\$\{/g)].map((m) => m[1]);
  assert.ok(prefixes.includes("checkin-missed"));
  for (const prefix of prefixes) assert.ok(eventKey.test(`${prefix}:x`), `prefix ${prefix}`);
});
