import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Tranche 1 uses a nonce CSP and keeps Design Lab desktop-only", () => {
  const proxy = source("src/proxy.ts");
  const layout = source("src/app/layout.tsx");
  const designLab = source("src/app/design-lab/layout.tsx");
  const config = source("next.config.ts");

  assert.match(proxy, /Content-Security-Policy/);
  assert.match(proxy, /nonce-/);
  assert.match(proxy, /frame-ancestors 'none'/);
  assert.match(layout, /nonce=\{nonce\}/);
  assert.match(config, /Strict-Transport-Security/);
  assert.doesNotMatch(designLab, /VERCEL_ENV|notFound\(\)/);

  const designPage = source("src/app/design-lab/page.tsx");
  const nav = source("src/components/AppNav.tsx");
  const frame = source("src/components/AppFrame.tsx");
  assert.match(designPage, /lg:hidden/);
  assert.match(designPage, /hidden lg:block/);
  assert.match(nav, /href="\/design-lab"/);
  assert.match(nav, /hidden lg:flex/);
  assert.match(frame, /"\/design-lab"/);
});

test("notification scheduler fails loudly and maintains an alert issue", () => {
  const workflow = source(".github/workflows/notifications-cron.yml");
  const route = source("src/app/api/notifications/send/route.ts");

  assert.match(workflow, /issues: write/);
  assert.match(workflow, /Notification cron configuration is missing/);
  assert.match(workflow, /Open or update cron alert/);
  assert.match(workflow, /Close recovered cron alert/);
  assert.match(route, /kind: "notification_cron"/);
  assert.match(route, /status: result\.ok \? 200 : 500/);
});

test("Dashboard initial owned data now starts on the server", () => {
  const page = source("src/app/dashboard/page.tsx");
  const client = source("src/app/dashboard/DashboardClient.tsx");
  const server = source("src/lib/supabase/server.ts");

  assert.doesNotMatch(page, /^"use client"/);
  assert.match(page, /requireServerUser\(\)/);
  assert.match(page, /listTasks\(supabase\)/);
  assert.match(page, /listActiveRoutines\(supabase\)/);
  assert.match(server, /createServerClient<Database>/);
  assert.doesNotMatch(client, /getSessionUser|useTransitionRouter/);
});

test("task creation no longer refetches the complete task list", () => {
  const client = source("src/app/dashboard/DashboardClient.tsx");
  const tasks = source("src/lib/db/tasks.ts");

  assert.match(tasks, /insert\(input\)[\s\S]*select\(TASK_COLUMNS\)[\s\S]*single\(\)/);
  assert.match(client, /const created = await addTask/);
  assert.doesNotMatch(client, /setTasks\(await listTasks\(\)\)/);
});

test("Dashboard has a route-shaped loading state and timezone handoff", () => {
  const loading = source("src/app/dashboard/loading.tsx");
  const worker = source("src/components/notifications/NotificationWorker.tsx");
  const page = source("src/app/dashboard/page.tsx");

  assert.match(loading, /xl:grid-cols/);
  assert.match(worker, /ROOTINE_TIMEZONE_COOKIE/);
  assert.match(page, /getServerLocalDay/);
});
