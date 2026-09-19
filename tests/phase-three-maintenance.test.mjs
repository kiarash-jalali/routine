import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("dead reminder introduction infrastructure is removed", () => {
  assert.equal(
    existsSync(
      new URL(
        "../src/components/notifications/ReminderPrompt.tsx",
        import.meta.url,
      ),
    ),
    false,
  );

  const notifications = source("src/lib/db/notifications.ts");
  const routines = source("src/app/routines/page.tsx");
  const database = source("src/types/database.ts");
  const migration = source(
    "supabase/migrations/20260919142905_phase3_remove_dead_reminder_intro.sql",
  );

  assert.doesNotMatch(notifications, /claimReminderIntroduction/);
  assert.doesNotMatch(
    routines,
    /ReminderPrompt|claimReminderIntroduction|requestPermission/,
  );
  assert.doesNotMatch(database, /claim_reminder_introduction|reminder_intro_seen/);
  assert.match(migration, /drop function if exists public\.claim_reminder_introduction/);
  assert.match(migration, /drop column if exists reminder_intro_seen/);
});

test("server notification queries stay on generated database types", () => {
  const cron = source("src/app/api/notifications/send/route.ts");
  const delivery = source("src/lib/server/reminderDelivery.ts");
  const preferences = source("src/lib/db/notifications.ts");

  assert.match(cron, /createClient<Database>/);
  assert.doesNotMatch(cron, /as PreferenceRow\[\]|as Array<\{/);
  assert.match(delivery, /SupabaseClient<Database>/);
  assert.doesNotMatch(delivery, /subscriptions\.data as PushTarget\[\]/);
  assert.match(preferences, /Tables<"notification_preferences">/);
  assert.doesNotMatch(preferences, /maybeSingle<NotificationPreference>/);
});

test("account deletion revokes refresh sessions before deleting the user", () => {
  const route = source("src/app/api/account/delete/route.ts");
  const revoke = route.indexOf("admin.auth.admin.signOut");
  const remove = route.indexOf("admin.auth.admin.deleteUser");

  assert.ok(revoke >= 0);
  assert.ok(remove > revoke);
  assert.match(route, /accessToken,\s*"global"/);
});

test("auth proxy turns stale refresh tokens into a normal login redirect", () => {
  const proxy = source("src/lib/supabase/proxy.ts");
  assert.match(proxy, /try \{[\s\S]*auth\.getClaims\(\)/);
  assert.match(proxy, /catch \{[\s\S]*return redirectToLogin\(request\)/);
});
