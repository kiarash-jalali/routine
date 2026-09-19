import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("server auth boundary validates privileged API requests", () => {
  const proxy = source("src/lib/supabase/proxy.ts");
  assert.match(proxy, /auth\.getClaims\(\)/);
  assert.doesNotMatch(proxy, /auth\.getSession\(\)/);

  const browserSession = source("src/lib/session.ts");
  assert.match(browserSession, /auth\.getSession\(\)/);

  for (const path of [
    "src/app/api/account/delete/route.ts",
    "src/app/api/account/export/route.ts",
    "src/app/api/notifications/subscription/route.ts",
  ]) {
    assert.match(source(path), /authenticatePrivilegedRequest/);
  }

  const requestAuth = source("src/lib/server/requestAuth.ts");
  assert.match(requestAuth, /auth\.getUser\(accessToken\)/);
  assert.match(requestAuth, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("first-run flow reaches Today without notification permission", () => {
  const onboarding = source("src/app/onboarding/page.tsx");
  assert.match(onboarding, /await completeOnboarding\(userId\)/);
  assert.match(onboarding, /router\.replace\("\/dashboard"\)/);
  assert.doesNotMatch(onboarding, /step === "name"/);
  assert.doesNotMatch(onboarding, /step === "ready"/);
  assert.doesNotMatch(onboarding, /ReminderSetup|ReminderPrompt|requestPermission/);

  const dashboard = source("src/app/dashboard/DashboardClient.tsx");
  assert.doesNotMatch(dashboard, /ReminderSetup|ReminderPrompt|requestPermission/);
});

test("Today supports routine completion and Guide stays discoverable", () => {
  const dashboard = source("src/app/dashboard/DashboardClient.tsx");
  assert.match(dashboard, /async function toggleRoutine/);
  assert.match(dashboard, /setDailyItemCompletion/);

  const nav = source("src/components/AppNav.tsx");
  assert.match(nav, /href="\/guide"/);

  const guide = source("src/app/guide/page.tsx");
  assert.match(guide, /guide\.installTitle/);
  assert.match(guide, /guide\.installIosBody/);
  assert.match(guide, /guide\.installBrowserBody/);
});
