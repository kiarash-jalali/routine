import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Today prioritizes the next unfinished timed item", () => {
  const dashboard = source("src/app/dashboard/DashboardClient.tsx");

  assert.match(dashboard, /dashboard\.upNext/);
  assert.match(
    dashboard,
    /todayReminders\.find\(\(reminder\) => !reminder\.completed\)/,
  );
  assert.match(dashboard, /openTodayTasks/);
  assert.match(dashboard, /completed: Boolean\(reminder\.taken_at\)/);
  assert.match(dashboard, /completed: Boolean\(session\.completed_at\)/);
});

test("core creation forms validate on blur and keep mobile actions reachable", () => {
  const routine = source("src/components/routines/RoutineForm.tsx");
  const medication = source("src/components/health/MedicationForm.tsx");
  const workout = source("src/components/workouts/WorkoutForm.tsx");
  const dashboard = source("src/app/dashboard/DashboardClient.tsx");
  const css = source("src/app/globals.css");

  for (const form of [routine, medication, workout]) {
    assert.match(form, /onBlur=/);
    assert.match(form, /invalid=/);
    assert.match(form, /form-actions-sticky/);
  }

  assert.match(dashboard, /titleTouched/);
  assert.match(dashboard, /task-title-error/);
  assert.match(dashboard, /form-actions-sticky/);
  assert.match(css, /\.field-error/);
  assert.match(css, /\.form-actions-sticky[\s\S]*position: sticky/);
});

test("Check-in has a fast complete-remaining path and respects date-only tasks", () => {
  const checkin = source("src/app/checkin/CheckinClient.tsx");

  assert.match(checkin, /function completeRemaining/);
  assert.match(checkin, /checkin\.completeRemaining/);
  assert.match(checkin, /task\.due_at && task\.due_has_time/);
  assert.match(checkin, /href="\/dashboard\?newTask=1"/);
});

test("Settings separates destructive controls and labels confirmation input", () => {
  const settings = source("src/app/settings/SettingsClient.tsx");

  assert.match(settings, /<Card className="border-danger-border">/);
  assert.match(settings, /settings\.typeDelete/);
  assert.match(settings, /<label className="grid gap-2 text-sm font-medium">[\s\S]*deleteConfirmation/);
  assert.match(settings, /settings-password-guidance/);
});

test("empty states and view controls use the shared UI patterns", () => {
  const health = source("src/app/health/HealthClient.tsx");
  const workout = source("src/app/workouts/WorkoutsClient.tsx");
  const routines = source("src/app/routines/RoutinesClient.tsx");
  const history = source("src/app/history/HistoryClient.tsx");

  assert.match(health, /<SegmentedControl/);
  assert.match(workout, /<SegmentedControl/);
  assert.match(health, /<EmptyState[\s\S]*action=/);
  assert.match(workout, /<EmptyState[\s\S]*action=/);
  assert.match(routines, /<EmptyState[\s\S]*action=/);
  assert.match(history, /title=\{t\("history\.emptyTitle"\)\}/);
});

test("loading shells mirror the revised page hierarchy", () => {
  const dashboard = source("src/app/dashboard/loading.tsx");
  const settings = source("src/app/settings/loading.tsx");
  const checkin = source("src/app/checkin/loading.tsx");

  assert.match(dashboard, /card mb-7 h-28/);
  assert.match(settings, /grid items-start gap-8 xl:grid-cols-2/);
  assert.match(settings, /space-y-8/);
  assert.match(checkin, /card h-28/);
});

test("status and password help text remain localized and programmatically connected", () => {
  const popup = source("src/components/MomentPopup.tsx");
  const guidance = source("src/components/auth/PasswordGuidance.tsx");
  const login = source("src/app/login/page.tsx");

  assert.doesNotMatch(popup, /Tap to dismiss/);
  assert.match(popup, /common\.dismiss/);
  assert.match(guidance, /id=\{id\}/);
  assert.match(login, /signup-password-guidance/);
});
