import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { loadTypeScriptModule } from "./load-typescript.mjs";

const { getThemePeriod, themeScript } = loadTypeScriptModule(
  new URL("../src/lib/theme.ts", import.meta.url),
);
const { isValidPushEndpoint } = loadTypeScriptModule(
  new URL("../src/lib/pushEndpoint.ts", import.meta.url),
);
const {
  fiveMinuteBucket,
  isLocalTimeDue,
  localClock,
  previousDateKey,
  routineOccursOnDay,
} = loadTypeScriptModule(
  new URL("../src/lib/schedule.ts", import.meta.url),
);

test("theme boundaries agree before and after hydration", () => {
  for (const [hour, period] of [
    [4, "night"],
    [5, "morning"],
    [10, "morning"],
    [11, "day"],
    [16, "day"],
    [17, "evening"],
    [20, "evening"],
    [21, "night"],
  ]) {
    assert.equal(getThemePeriod(hour), period);
    for (const preference of [null, "light", "dark"]) {
      const root = { dataset: {} };
      runInNewContext(themeScript, {
        document: {
          documentElement: root,
          querySelectorAll: () => [],
        },
        localStorage: { getItem: () => preference },
        window: { matchMedia: () => ({ matches: false }) },
        Date: class {
          getHours() {
            return hour;
          }
        },
      });
      assert.equal(root.dataset.period, period);
      assert.equal(root.dataset.themeMode, preference ?? "auto");
      assert.equal(
        root.dataset.theme,
        preference ?? (period === "night" ? "dark" : "light"),
      );
    }
  }
});

test("device clocks handle offsets and midnight boundaries", () => {
  assert.deepEqual(
    localClock(new Date("2026-09-18T21:15:00Z"), "Asia/Tehran"),
    { day: "2026-09-19", time: "00:45" },
  );
  assert.deepEqual(localClock(new Date("2026-09-18T00:00:00Z"), "UTC"), {
    day: "2026-09-18",
    time: "00:00",
  });
});

test("notification schedule helpers keep five-minute cadence and local days", () => {
  assert.equal(
    fiveMinuteBucket(new Date("2026-09-20T16:07:59Z")),
    "2026-09-20T16:05:00.000Z",
  );
  assert.equal(isLocalTimeDue("18:00", "18:00"), true);
  assert.equal(isLocalTimeDue("18:14", "18:00"), true);
  assert.equal(isLocalTimeDue("18:15", "18:00"), false);
  assert.equal(isLocalTimeDue("00:07", "00:05"), true);
  assert.equal(previousDateKey("2026-03-01"), "2026-02-28");
  assert.equal(routineOccursOnDay("daily", null, "2026-09-22"), true);
  assert.equal(routineOccursOnDay("weekly", [1, 3], "2026-09-21"), true);
  assert.equal(routineOccursOnDay("weekly", [1, 3], "2026-09-22"), false);
});

test("date-only tasks remain non-notifying while explicit times are persisted", () => {
  const fields = readFileSync(
    new URL("../src/components/tasks/TaskScheduleFields.tsx", import.meta.url),
    "utf8",
  );
  const dashboard = readFileSync(
    new URL("../src/app/dashboard/DashboardClient.tsx", import.meta.url),
    "utf8",
  );
  const tasks = readFileSync(
    new URL("../src/lib/db/tasks.ts", import.meta.url),
    "utf8",
  );

  assert.match(fields, /hasTime: boolean/);
  assert.match(fields, /Boolean\(nextTime\)/);
  assert.match(dashboard, /due_has_time: dueHasTime/);
  assert.match(dashboard, /task\.due_at && task\.due_has_time/);
  assert.match(tasks, /due_has_time/);
});

test("task notifications are one-shot while medication keeps five-minute buckets", () => {
  const route = readFileSync(
    new URL("../src/app/api/notifications/send/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /\.eq\("due_has_time", true\)/);
  assert.match(route, /`task:\${task\.id}`/);
  assert.doesNotMatch(route, /`task:\${task\.id}:\${eventBucket}`/);
  assert.match(route, /`health:\${reminder\.id}:\${eventBucket}`/);
});

test("medication repeats are limited to the user's current local day", () => {
  const route = readFileSync(
    new URL("../src/app/api/notifications/send/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /\.in\("scheduled_day", currentDays\)/);
  assert.match(route, /reminder\.scheduled_day !== clock\.day/);
});

test("repeating medication reminders reuse one visible notification slot", () => {
  const route = readFileSync(
    new URL("../src/app/api/notifications/send/route.ts", import.meta.url),
    "utf8",
  );
  const worker = readFileSync(
    new URL("../public/sw.js", import.meta.url),
    "utf8",
  );

  assert.match(route, /`health:\${reminder\.id}:\${eventBucket}`/);
  assert.match(route, /`health:\${reminder\.id}`/);
  assert.match(worker, /renotify: message\.renotify === true/);
});

test("push transport rejects SSRF destinations", () => {
  for (const url of [
    "https://fcm.googleapis.com/fcm/send/test",
    "https://updates.push.services.mozilla.com/wpush/v2/test",
    "https://web.push.apple.com/test",
  ]) {
    assert.equal(isValidPushEndpoint(url), true);
  }

  for (const url of [
    "https://127.0.0.1/private",
    "https://fcm.googleapis.com.evil.test/",
    "https://evil.test@fcm.googleapis.com/",
    "http://fcm.googleapis.com/",
    "https://fcm.googleapis.com:444/",
    "https://169.254.169.254/",
  ]) {
    assert.equal(isValidPushEndpoint(url), false);
  }
});
