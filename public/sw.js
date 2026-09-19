const SW_VERSION = "v1";
const CACHE_PREFIX = "rootine-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-${SW_VERSION}`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-${SW_VERSION}`;
const OFFLINE_URL = "/offline.html";
const DATABASE_NAME = "rootine-offline";
const DATABASE_VERSION = 1;
const STATE_STORE = "state";
const MUTATION_STORE = "mutations";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" }))),
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
      clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
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

async function readOfflineState() {
  try {
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
    const pending = Array.isArray(mutations)
      ? mutations.filter(
          (mutation) => !snapshot?.userId || mutation.userId === snapshot.userId,
        ).length
      : 0;
    return { snapshot: snapshot || null, pending };
  } catch {
    return { snapshot: null, pending: 0 };
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function offlineCopy(language) {
  if (language === "fa") {
    return {
      title: "فعلاً آفلاینی.",
      body: "آخرین نمای ذخیره‌شده‌ات هنوز اینجاست. برای تازه‌سازی اطلاعات دوباره آنلاین شو.",
      statusTitle: "بدون اینترنت",
      statusBody: "اگر اپ از قبل باز بوده باشد، تغییرات انجام کارها و مرور روز برای همگام‌سازی نگه داشته می‌شوند.",
      routines: "روتین‌ها",
      tasks: "کارها",
      empty: "هنوز نمای آفلاینی ذخیره نشده است.",
      pending: (count) => `${count} تغییر منتظر همگام‌سازی است.`,
      saved: (value) => `آخرین ذخیره: ${value}`,
    };
  }

  return {
    title: "You’re offline for now.",
    body: "Your last saved view is still here. Reconnect to refresh it.",
    statusTitle: "No connection",
    statusBody:
      "If the app was already open, routine, task and check-in changes are kept for the next sync.",
    routines: "Routines",
    tasks: "Tasks",
    empty: "No offline view has been saved on this device yet.",
    pending: (count) => `${count} change${count === 1 ? "" : "s"} waiting to sync.`,
    saved: (value) => `Last saved: ${value}`,
  };
}

function renderItems(title, items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return `<section><h2>${escapeHtml(title)}</h2><ul>${items
    .map(
      (item) =>
        `<li><span class="mark">${item.completed ? "✓" : "○"}</span><span>${escapeHtml(item.title)}</span></li>`,
    )
    .join("")}</ul></section>`;
}

async function offlineResponse() {
  const cached = await caches.match(OFFLINE_URL);
  if (!cached) {
    return new Response("rootine is offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const [{ snapshot, pending }, template] = await Promise.all([
    readOfflineState(),
    cached.text(),
  ]);
  const language = snapshot?.language === "fa" ? "fa" : "en";
  const copy = offlineCopy(language);
  const locale = language === "fa" ? "fa-IR" : "en";
  const saved = snapshot?.savedAt
    ? copy.saved(
        new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(snapshot.savedAt)),
      )
    : copy.empty;
  const content = snapshot
    ? renderItems(copy.routines, snapshot.routines) +
      renderItems(copy.tasks, snapshot.tasks)
    : `<section><p class="muted">${escapeHtml(copy.empty)}</p></section>`;
  const statusBody = pending > 0 ? copy.pending(pending) : copy.statusBody;

  const html = template
    .replaceAll("{{LANG}}", language)
    .replaceAll("{{DIR}}", language === "fa" ? "rtl" : "ltr")
    .replaceAll("{{TITLE}}", escapeHtml(copy.title))
    .replaceAll("{{BODY}}", escapeHtml(copy.body))
    .replaceAll("{{STATUS_TITLE}}", escapeHtml(copy.statusTitle))
    .replaceAll("{{STATUS_BODY}}", escapeHtml(statusBody))
    .replaceAll("{{CONTENT}}", content)
    .replaceAll("{{SAVED}}", escapeHtml(saved));

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
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
    event.respondWith(fetch(request).catch(() => offlineResponse()));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/pwa/") ||
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
