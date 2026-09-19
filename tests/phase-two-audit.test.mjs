import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("onboarding hands the first routine success into Today once", () => {
  const onboarding = source("src/app/onboarding/page.tsx");
  const dashboard = source("src/app/dashboard/page.tsx");
  const firstRun = source("src/lib/firstRun.ts");

  assert.match(onboarding, /rememberFirstRoutineSuccess\(values\.title\)/);
  assert.match(dashboard, /consumeFirstRoutineSuccess\(\)/);
  assert.match(dashboard, /dashboard\.firstSuccessTitle/);
  assert.match(firstRun, /sessionStorage\.removeItem/);
});

test("settings use four clear groups and hide infrequent account controls", () => {
  const settings = source("src/app/settings/page.tsx");

  for (const key of [
    "settings.personal",
    "settings.device",
    "settings.account",
    "settings.data",
  ]) {
    assert.match(settings, new RegExp(key.replace(".", "\\.")));
  }

  assert.match(settings, /function SettingsDisclosure/);
  assert.match(settings, /<details/);
  assert.doesNotMatch(settings, /settings\.guideBody/);
});

test("phase two database migration removes unused GraphQL and covers medication FK", () => {
  const migration = source(
    "supabase/migrations/PHASE2_MIGRATION_PLACEHOLDER.sql",
  );

  assert.match(
    migration,
    /create index if not exists medication_reminders_medication_user_idx/i,
  );
  assert.match(
    migration,
    /on public\.medication_reminders \(medication_id, user_id\)/i,
  );
  assert.match(migration, /drop extension if exists pg_graphql/i);
});
