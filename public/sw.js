self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("rootine", {
      body: "A gentle reminder to check in with your day.",
      icon: "/pwa/icon-192",
      badge: "/pwa/icon-192",
      tag: "routine-daily-checkin",
      renotify: false,
      data: { url: "/checkin" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
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
