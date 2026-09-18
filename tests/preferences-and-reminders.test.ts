import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { getThemePeriod, themeScript } from "../src/lib/theme";
import { isValidPushEndpoint } from "../src/lib/pushEndpoint";
import { localClock } from "../src/lib/schedule";
test("theme boundaries agree before and after hydration, preserving explicit preference", () => {
  for (const [hour, period] of [
    [4, "night"],
    [5, "morning"],
    [10, "morning"],
    [11, "day"],
    [16, "day"],
    [17, "evening"],
    [20, "evening"],
    [21, "night"],
  ] as const) {
    assert.equal(getThemePeriod(hour), period);
    for (const preference of [null, "light", "dark"]) {
      const root = { dataset: {} as Record<string, string> };
      runInNewContext(themeScript, {
        document: { documentElement: root },
        localStorage: { getItem: () => preference },
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
test("device clocks handle non-hour offsets and the midnight day boundary", () => {
  assert.deepEqual(
    localClock(new Date("2026-09-18T21:15:00Z"), "Asia/Tehran"),
    { day: "2026-09-19", time: "00:45" },
  );
  assert.deepEqual(localClock(new Date("2026-09-18T00:00:00Z"), "UTC"), {
    day: "2026-09-18",
    time: "00:00",
  });
});
test("push transport rejects server-side request forgery destinations", () => {
  for (const url of [
    "https://fcm.googleapis.com/fcm/send/test",
    "https://updates.push.services.mozilla.com/wpush/v2/test",
    "https://web.push.apple.com/test",
  ])
    assert.equal(isValidPushEndpoint(url), true);
  for (const url of [
    "https://127.0.0.1/private",
    "https://fcm.googleapis.com.evil.test/",
    "https://evil.test@fcm.googleapis.com/",
    "http://fcm.googleapis.com/",
    "https://fcm.googleapis.com:444/",
    "https://169.254.169.254/",
  ])
    assert.equal(isValidPushEndpoint(url), false);
});
