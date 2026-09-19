const SW_VERSION = "v2";
const CACHE_PREFIX = "rootine-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-${SW_VERSION}`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-${SW_VERSION}`;
const OFFLINE_URL = "/offline.html";
const OFFLINE_SCRIPT_URL = "/offline.js";
const DATABASE_NAME = "rootine-offline";
const DATABASE_VERSION = 1;
const STATE_STORE = "state";
const MUTATION_STORE = "mutations";
const SYNC_TAG = "rootine-offline-sync";

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .open(SHELL_CACHE)
        .then((cache) =>
          cache.add(new Request(OFFLINE_URL, { cache: "reload" })),
        ),
      caches
        .open(ASSET_CACHE)
        .then((cache) =>
          cache.add(new Request(OFFLINE_SCRIPT_URL, { cache: "reload" })),
        ),
    ]),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) =>
                  key.startsWith(CACHE_PREFIX) &&
                  key !== SHELL_CACHE &&
                  key !== ASSET_CACHE,
              )
              .map((key) => caches.delete(key)),
          ),
        ),
      self.registration.navigationPreload?.enable?.().catch(() => undefined),
      clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (
    event.data?.type === "REGISTER_OFFLINE_SYNC" &&
    "sync" in self.registration
  ) {
    event.waitUntil(
      self.registration.sync.register(SYNC_TAG).catch(() => undefined),
    );
  }
});

function openOfflineDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STATE_STORE)) {
        database.createObjectStore(STATE_STORE);
      }
      if (!database.objectStoreNames.contains(MUTATION_STORE)) {
        database.createObjectStore(MUTATION_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function readOfflineQueue() {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(
    [STATE_STORE, MUTATION_STORE],
    "readonly",
  );
  const snapshot = await idbRequest(
    transaction.objectStore(STATE_STORE).get("snapshot"),
  );
  const mutations = await idbRequest(
    transaction.objectStore(MUTATION_STORE).getAll(),
  );
  database.close();

  const ownedMutations =
    snapshot?.userId && Array.isArray(mutations)
      ? mutations
          .filter((mutation) => mutation.userId === snapshot.userId)
          .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt))
      : [];

  return { snapshot: snapshot || null, mutations: ownedMutations };
}

async function removeOfflineMutations(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;

  const database = await openOfflineDatabase();
  const transaction = database.transaction(MUTATION_STORE, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(MUTATION_STORE);
  for (const id of new Set(ids)) {
    if (typeof id === "string") store.delete(id);
  }
  await done;
  database.close();
}

async function tellClientsOfflineSyncChanged() {
  const windows = await clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of windows) {
    client.postMessage({ type: "ROOTINE_OFFLINE_SYNCED" });
  }
}

async function syncOfflineQueue() {
  let state;
  try {
    state = await readOfflineQueue();
  } catch {
    return;
  }

  if (!state.snapshot?.userId || state.mutations.length === 0) return;

  let response;
  try {
    response = await fetch("/api/offline/sync", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mutations: state.mutations }),
    });
  } catch {
    throw new Error("offline_sync_network_failed");
  }

  if (!response.ok) {
    throw new Error(`offline_sync_failed_${response.status}`);
  }

  const result = await response.json();
  await removeOfflineMutations([
    ...(Array.isArray(result.appliedIds) ? result.appliedIds : []),
    ...(Array.isArray(result.discardedIds) ? result.discardedIds : []),
  ]);
  await tellClientsOfflineSyncChanged();

  if (Array.isArray(result.retryIds) && result.retryIds.length > 0) {
    throw new Error("offline_sync_retry_required");
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncOfflineQueue());
  }
});

async function offlineResponse() {
  const cached = await caches.match(OFFLINE_URL);
  if (cached) return cached;
  return new Response("rootine is offline.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function cacheAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    fetch(request)
      .then((response) => {
        if (response.ok) return cache.put(request, response.clone());
      })
      .catch(() => undefined);
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;
          return await fetch(request);
        } catch {
          return offlineResponse();
        }
      })(),
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/pwa/") ||
    url.pathname === OFFLINE_SCRIPT_URL ||
    ["style", "script", "font", "image"].includes(request.destination)
  ) {
    event.respondWith(cacheAsset(request));
  }
});

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data?.json() || {};
  } catch {
    /* Older empty pushes use the check-in fallback. */
  }
  const allowedUrls = ["/checkin", "/health", "/workouts"];
  const url = allowedUrls.includes(message.url) ? message.url : "/checkin";
  event.waitUntil(
    self.registration.showNotification("rootine", {
      body:
        typeof message.body === "string"
          ? message.body.slice(0, 300)
          : "A gentle reminder to check in with your day.",
      lang: message.lang === "fa" ? "fa" : "en",
      dir: message.lang === "fa" ? "rtl" : "ltr",
      icon: "/pwa/icon-192",
      badge: "/pwa/icon-192",
      tag: `rootine-${url.slice(1)}`,
      renotify: false,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requested = event.notification.data?.url;
  const targetUrl = ["/checkin", "/health", "/workouts"].includes(requested)
    ? requested
    : "/dashboard";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return clients.openWindow(targetUrl);
      }),
  );
});
