import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

// CLAUDE.md rule 4: health data (medication names, doses, notes) never goes
// into push payloads. These tests guard both the payload builder and the
// scheduled sender that feeds it.

const { en } = loadTypeScriptModule(
  new URL("../src/lib/i18n/en.ts", import.meta.url),
);
const { fa } = loadTypeScriptModule(
  new URL("../src/lib/i18n/fa.ts", import.meta.url),
  { "./en": { en } },
);
const i18n = loadTypeScriptModule(
  new URL("../src/lib/i18n/index.ts", import.meta.url),
  { "./en": { en }, "./fa": { fa } },
);
const pushEndpoint = loadTypeScriptModule(
  new URL("../src/lib/pushEndpoint.ts", import.meta.url),
);

const sent = [];
const { sendReminderPush } = loadTypeScriptModule(
  new URL("../src/lib/server/webPush.ts", import.meta.url),
  {
    "server-only": {},
    "web-push": {
      sendNotification: async (subscription, payload, options) => {
        sent.push({ subscription, payload, options });
        return { statusCode: 201 };
      },
    },
    "@/lib/pushEndpoint": pushEndpoint,
    "@/lib/i18n": i18n,
  },
);

const target = {
  id: "subscription-1",
  endpoint: "https://fcm.googleapis.com/fcm/send/example-endpoint",
  p256dh: "p256dh-key",
  auth: "auth-secret",
};

process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??= "public-key";
process.env.VAPID_PRIVATE_KEY ??= "private-key";
process.env.VAPID_SUBJECT ??= "mailto:test@example.com";

const sensitive = ["Sertraline", "50 mg", "take with food after lunch"];

for (const language of ["en", "fa"]) {
  test(`health push (${language}) never carries the reminder name, dose or notes`, async () => {
    sent.length = 0;
    for (const label of [
      sensitive[0],
      `${sensitive[0]} ${sensitive[1]}`,
      `${sensitive[0]} — ${sensitive[1]} — ${sensitive[2]}`,
    ]) {
      const status = await sendReminderPush(
        target,
        "health",
        language,
        "health:reminder-1:bucket",
        label,
        "health:reminder-1",
      );
      assert.equal(status, 201);
    }

    assert.equal(sent.length, 3);
    const expectedBody = language === "fa" ? fa["reminder.genericHealth"] : en["reminder.genericHealth"];
    for (const { payload } of sent) {
      for (const value of sensitive) {
        assert.ok(
          !payload.includes(value),
          `health push payload leaked "${value}": ${payload}`,
        );
      }
      const parsed = JSON.parse(payload);
      assert.equal(parsed.body, expectedBody);
      assert.equal(parsed.url, "/health");
      assert.equal(parsed.lang, language);
    }
  });
}

test("non-health pushes still show their item label", async () => {
  sent.length = 0;
  await sendReminderPush(target, "task", "en", "task:1:bucket", "Water plants");
  assert.equal(JSON.parse(sent[0].payload).body, "Water plants");
});

test("scheduled sender neither reads nor forwards medication names", () => {
  const route = readFileSync(
    new URL("../src/app/api/notifications/send/route.ts", import.meta.url),
    "utf8",
  );
  const healthSelect = route.match(
    /from\("medication_reminders"\)\s*\.select\(\s*"([^"]+)"/,
  );
  assert.ok(healthSelect, "medication_reminders select not found");
  const columns = healthSelect[1].split(",").map((column) => column.trim());
  for (const column of ["name", "dose", "dosage", "notes", "instructions"]) {
    assert.ok(
      !columns.includes(column),
      `medication_reminders select must not read "${column}" for push`,
    );
  }
  assert.doesNotMatch(route, /reminder\.(name|dose|dosage|notes|instructions)\b/);
});
