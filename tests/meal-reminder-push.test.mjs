import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

// Meal-plan and grocery pushes carry generic, translated copy only: never food
// or recipe names (docs/nutrition-roadmap.md S4 acceptance, §3, §7).

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const en = loadTypeScriptModule(new URL("../src/lib/i18n/en.ts", import.meta.url));
const fa = loadTypeScriptModule(new URL("../src/lib/i18n/fa.ts", import.meta.url));
const i18n = loadTypeScriptModule(new URL("../src/lib/i18n/index.ts", import.meta.url), {
  "./en": en,
  "./fa": fa,
});

const sent = [];
const push = loadTypeScriptModule(new URL("../src/lib/server/webPush.ts", import.meta.url), {
  "server-only": {},
  "web-push": {
    sendNotification: async (_target, payload) => {
      sent.push(payload);
      return { statusCode: 201 };
    },
  },
  "@/lib/pushEndpoint": { isValidPushEndpoint: () => true },
  "@/lib/i18n": i18n,
});

const NAMES = ["Ghormeh sabzi", "قورمه سبزی", "Chicken", "مرغ"];

test("meal plan and grocery payloads use only generic copy, whatever label is passed", () => {
  for (const language of ["en", "fa"]) {
    for (const kind of ["meal_plan", "grocery"]) {
      for (const label of [...NAMES, null]) {
        const payload = push.reminderPayload(kind, language, `${kind}:2026-11-28`, label, null, kind);
        const json = JSON.stringify(payload);
        for (const name of NAMES) assert.ok(!json.includes(name), `${kind}/${language} leaked ${name}`);
        const bodyKey = kind === "meal_plan" ? "reminder.mealPlanBody" : "reminder.groceryBody";
        const titleKey = kind === "meal_plan" ? "reminder.mealPlanTitle" : "reminder.groceryTitle";
        assert.equal(payload.body, i18n.translate(language, bodyKey));
        assert.equal(payload.title, i18n.translate(language, titleKey));
        assert.equal(payload.category, kind);
        assert.equal(payload.event, `${kind}:2026-11-28`);
      }
    }
  }
  assert.equal(push.notificationUrl("meal_plan"), "/food?tab=plan&week=next");
  assert.equal(push.notificationUrl("grocery"), "/food?tab=groceries&week=next");
});

test("the sent push carries the generic payload, not the label", async () => {
  const saved = ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"].map((key) => [key, process.env[key]]);
  for (const [key] of saved) process.env[key] = "test";
  try {
    sent.length = 0;
    const status = await push.sendReminderPush(
      { id: "s", endpoint: "https://push.example/x", p256dh: "k", auth: "a" },
      "grocery",
      "fa",
      "grocery:2026-11-28",
      "قورمه سبزی",
      null,
      "grocery",
    );
    assert.equal(status, 201);
    assert.equal(sent.length, 1);
    const payload = JSON.parse(sent[0]);
    assert.equal(payload.body, i18n.translate("fa", "reminder.groceryBody"));
    for (const name of NAMES) assert.ok(!sent[0].includes(name));
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("the sender never reads names for weekly reminders", () => {
  const route = source("src/app/api/notifications/send/route.ts");
  // Only dates and owners are read from the plan.
  const planSelect = route.match(/from\("meal_plan_entries"\)\s*\.select\("([^"]+)"\)/);
  assert.ok(planSelect, "the sender no longer checks next week's plan");
  assert.equal(planSelect[1], "user_id,plan_date");
  assert.doesNotMatch(route, /from\("(recipes|foods|grocery_list_items|recipe_ingredients)"\)/);
  // Weekly deliveries pass no label.
  for (const call of route.matchAll(/deliver\(\s*preference\.user_id,\s*"(meal_plan|grocery)"[\s\S]*?\);/g)) {
    assert.doesNotMatch(call[0], /title|name|label/);
  }
  // The service worker only opens the two generic deep links for these categories.
  const sw = source("public/sw.js");
  assert.match(sw, /"\/food\?tab=plan&week=next"/);
  assert.match(sw, /"\/food\?tab=groceries&week=next"/);
});
