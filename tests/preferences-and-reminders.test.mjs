import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { loadTypeScriptModule } from "./load-typescript.mjs";

const { getThemePeriod, themeScript } = loadTypeScriptModule(
  new URL("../src/lib/theme.ts", import.meta.url),
);
const { isValidPushEndpoint } = loadTypeScriptModule(
  new URL("../src/lib/pushEndpoint.ts", import.meta.url),
);
const { localClock } = loadTypeScriptModule(
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
