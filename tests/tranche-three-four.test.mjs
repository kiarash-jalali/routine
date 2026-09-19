import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Tranche 3 renders language direction from a server-known cookie", () => {
  const layout = source("src/app/layout.tsx");
  const provider = source("src/components/preferences/LanguageProvider.tsx");
  const i18n = source("src/lib/i18n/index.ts");

  assert.match(layout, /cookies\(\)/);
  assert.match(layout, /lang=\{language\}/);
  assert.match(layout, /dir=\{language === "fa" \? "rtl" : "ltr"\}/);
  assert.match(provider, /languageCookieKey/);
  assert.match(provider, /initialLanguage/);
  assert.match(i18n, /languageCookieKey/);
});

test("Tranche 3 exposes explicit theme choices and localized destructive confirmation", () => {
  const picker = source("src/components/preferences/ThemePicker.tsx");
  const toggle = source("src/components/ThemeToggle.tsx");
  const settings = source("src/app/settings/SettingsClient.tsx");

  assert.match(picker, /SegmentedControl/);
  assert.doesNotMatch(picker, /function cycle/);
  assert.match(toggle, /<select/);
  assert.doesNotMatch(toggle, /function toggle/);
  assert.match(settings, /language === "fa" \? "حذف" : "DELETE"/);
});

test("Tranche 3 improves accessibility and RTL-safe styling", () => {
  const ui = source("src/components/ui.tsx");
  const polish = source("src/app/stability-polish.css");
  const globals = source("src/app/globals.css");

  assert.match(ui, /common\.completion/);
  assert.match(polish, /month-calendar-status[\s\S]*font-size: 11px/);
  assert.match(polish, /inset-inline-start: 3px/);
  assert.match(globals, /--muted-soft: #5d6e64/);
});

test("Tranche 4 makes core life areas permanent and removes Feedback from primary nav", () => {
  const nav = source("src/components/AppNav.tsx");
  const settings = source("src/app/settings/SettingsClient.tsx");

  assert.match(nav, /href: "\/health"/);
  assert.match(nav, /href: "\/workouts"/);
  assert.doesNotMatch(nav, /href="\/feedback"/);
  assert.match(settings, /href="\/feedback"/);
});

test("Tranche 4 improves onboarding, first-day actions, reminders and auth UX", () => {
  const onboarding = source("src/app/onboarding/OnboardingClient.tsx");
  const onboardingPage = source("src/app/onboarding/page.tsx");
  const dashboard = source("src/app/dashboard/DashboardClient.tsx");
  const login = source("src/app/login/page.tsx");

  assert.match(onboarding, /onboarding\.quickStart/);
  assert.match(onboardingPage, /replay/);
  assert.match(dashboard, /dashboard\.dayOneTitle/);
  assert.match(dashboard, /dashboard\.setupReminder/);
  assert.match(dashboard, /common\.tomorrow/);
  assert.match(login, /auth\.resend/);
  assert.match(login, /PasswordGuidance/);
});

test("existing profile locale is synchronized before authenticated navigation", () => {
  const login = source("src/app/login/page.tsx");
  assert.match(login, /profile\.locale !== language/);
  assert.match(login, /await setLanguage\(profile\.locale\)/);
  assert.ok(
    login.indexOf("await setLanguage(profile.locale)") <
      login.indexOf('router.push('),
  );
});
