import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("onboarding supports starter templates and deliberate replay", () => {
  const page = source("src/app/onboarding/page.tsx");
  const client = source("src/app/onboarding/OnboardingClient.tsx");
  const settings = source("src/app/settings/SettingsClient.tsx");

  assert.match(page, /replayMode = replay === "1"/);
  assert.match(page, /profile\.onboarding_completed && !replayMode/);
  assert.match(client, /onboarding\.presetWater/);
  assert.match(client, /onboarding\.presetWalk/);
  assert.match(client, /routineVersion/);
  assert.match(settings, /href="\/onboarding\?replay=1"/);
});

test("Today improves day-one, mobile check-in and task empty states", () => {
  const dashboard = source("src/app/dashboard/DashboardClient.tsx");

  assert.match(dashboard, /dashboard\.dayOneTitle/);
  assert.match(dashboard, /xl:hidden/);
  assert.match(dashboard, /hidden xl:block/);
  assert.match(dashboard, /task\.addFirst/);
  assert.match(dashboard, /common\.tomorrow/);
  assert.match(dashboard, /common\.yesterday/);
});

test("reminder discovery is post-value and never requests permission", () => {
  const dashboard = source("src/app/dashboard/DashboardClient.tsx");

  assert.match(dashboard, /hasDailyValue/);
  assert.match(dashboard, /Notification\.permission/);
  assert.match(dashboard, /href="\/settings#reminders"/);
  assert.doesNotMatch(dashboard, /requestPermission\(/);
});

test("Health and Sport are permanent nav destinations while Feedback moves to Settings", () => {
  const nav = source("src/components/AppNav.tsx");
  const settings = source("src/app/settings/SettingsClient.tsx");

  assert.match(nav, /href="\/health"/);
  assert.match(nav, /href="\/workouts"/);
  assert.doesNotMatch(nav, /href="\/feedback"/);
  assert.match(settings, /href="\/feedback"/);
});

test("password guidance and signup resend are available", () => {
  const login = source("src/app/login/page.tsx");
  const reset = source("src/app/reset-password/page.tsx");
  const settings = source("src/app/settings/SettingsClient.tsx");
  const guidance = source("src/components/auth/PasswordGuidance.tsx");

  assert.match(login, /auth\.resend/);
  assert.match(login, /login\.resend/);
  assert.match(login, /PasswordGuidance/);
  assert.match(reset, /PasswordGuidance/);
  assert.match(settings, /PasswordGuidance/);
  assert.match(guidance, /MIN_PASSWORD_LENGTH/);
});

test("old hardcoded English streak and routine helpers are gone", () => {
  const streak = source("src/lib/streak.ts");
  const schedule = source("src/lib/routineSchedule.ts");

  assert.doesNotMatch(streak, /You showed up today|Your rhythm is still alive/);
  assert.doesNotMatch(schedule, /Every day ·|No days selected|No time/);
});
