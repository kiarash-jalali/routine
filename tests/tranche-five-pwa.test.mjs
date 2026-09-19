import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Tranche 5 service worker has versioned offline routing and controlled activation", () => {
  const worker = source("public/sw.js");

  assert.match(worker, /SW_VERSION/);
  assert.match(worker, /addEventListener\("fetch"/);
  assert.match(worker, /OFFLINE_URL/);
  assert.match(worker, /caches\.delete/);
  assert.match(worker, /SKIP_WAITING/);
  assert.doesNotMatch(
    worker,
    /addEventListener\("install"[\s\S]{0,200}skipWaiting\(\)/,
  );
});

test("Tranche 5 queues only daily completion/check-in mutations in IndexedDB", () => {
  const store = source("src/lib/offlineStore.ts");
  const checkins = source("src/lib/db/checkins.ts");

  assert.match(store, /daily_item_completion/);
  assert.match(store, /finish_daily_checkin/);
  assert.match(store, /indexedDB\.open/);
  assert.match(checkins, /queueDailyItemCompletion/);
  assert.match(checkins, /queueFinishDailyCheckin/);
  assert.match(store, /syncOfflineMutations/);
  assert.match(source("src/app/api/offline/sync/route.ts"), /set_daily_item_completion/);
  assert.match(source("src/app/api/offline/sync/route.ts"), /finish_daily_checkin/);
});

test("Tranche 5 exposes offline, pending-sync and safe-update UI", () => {
  const status = source("src/components/pwa/PwaStatus.tsx");
  const layout = source("src/app/layout.tsx");

  assert.match(status, /navigator\.onLine/);
  assert.match(status, /OFFLINE_QUEUE_EVENT/);
  assert.match(status, /registration\.waiting/);
  assert.match(status, /SKIP_WAITING/);
  assert.match(source("public/sw.js"), /rootine-offline-sync/);
  assert.match(source("public/offline.js"), /daily_item_completion/);
  assert.match(source("public/offline.js"), /finish_daily_checkin/);
  assert.match(layout, /<PwaStatus \/>/);
});

test("Tranche 5 repairs push registrations without silently requesting permission", () => {
  const notifications = source("src/lib/notifications.ts");
  const worker = source("src/components/notifications/NotificationWorker.tsx");

  assert.match(notifications, /reconcilePushNotifications/);
  assert.match(notifications, /applicationServerKeyMatches/);
  assert.match(notifications, /PUSH_INTENT_KEY/);
  assert.match(worker, /reconcilePushNotifications/);

  const reconcileBody = notifications.slice(
    notifications.indexOf("export async function reconcilePushNotifications"),
  );
  assert.doesNotMatch(reconcileBody, /Notification\.requestPermission/);
});

test("Tranche 5 manifest has localized high-value shortcuts", () => {
  const manifestSource = source("src/app/manifest.ts");
  const dashboard = source("src/app/dashboard/DashboardClient.tsx");

  assert.match(manifestSource, /cookies\(\)/);
  assert.match(manifestSource, /shortcuts/);
  assert.match(manifestSource, /lang:/);
  assert.match(manifestSource, /dir:/);
  assert.match(manifestSource, /\/checkin/);
  assert.match(manifestSource, /\/dashboard\?newTask=1/);
  assert.match(dashboard, /newTask/);
});

test("Tranche 5 keeps an offline read snapshot for Dashboard and Check-in", () => {
  const dashboard = source("src/app/dashboard/DashboardClient.tsx");
  const checkin = source("src/app/checkin/CheckinClient.tsx");

  assert.match(dashboard, /saveOfflineSnapshot/);
  assert.match(checkin, /saveOfflineSnapshot/);
  assert.match(source("public/offline.html"), /offline-content/);
  assert.match(source("public/offline.html"), /offline\.js/);
});

test("Tranche 5 keeps health and medication data out of the offline cache", () => {
  const store = source("src/lib/offlineStore.ts");
  const shell = source("public/offline.js");

  assert.doesNotMatch(store, /medication|dose|health_plan|medication_plan/i);
  assert.doesNotMatch(shell, /medication|dose|health_plan|medication_plan/i);
});

test("Tranche 5 sync validates account ownership on the server", () => {
  const syncRoute = source("src/app/api/offline/sync/route.ts");

  assert.match(syncRoute, /getClaims\(\)/);
  assert.match(syncRoute, /mutation\.userId !== userId/);
  assert.match(syncRoute, /Cross-origin sync is not allowed/);
  assert.match(syncRoute, /MAX_MUTATIONS/);
});
