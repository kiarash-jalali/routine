self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));

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
