import type { StoredPushSubscription } from "@/lib/db/notifications";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function notificationsSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function currentNotificationPermission() {
  if (!notificationsSupported()) return "unsupported" as const;
  return Notification.permission;
}

export async function getServiceWorkerRegistration() {
  if (!notificationsSupported()) {
    throw new Error("Notifications are not supported on this device.");
  }

  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;

  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function enablePushNotifications() {
  if (!notificationsSupported()) {
    throw new Error("Notifications are not supported on this device.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("Push notifications are not configured yet.");
  }

  const registration = await getServiceWorkerRegistration();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(publicKey),
    });
  }

  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("The browser returned an incomplete push subscription.");
  }

  return {
    browserSubscription: subscription,
    storedSubscription: {
      endpoint: json.endpoint,
      p256dh,
      auth,
    } satisfies StoredPushSubscription,
  };
}

export async function disablePushNotifications() {
  if (!notificationsSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return null;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}

export async function showNotificationTest() {
  const registration = await getServiceWorkerRegistration();
  await registration.showNotification("Routine", {
    body: "Notifications are ready. We’ll keep reminders gentle.",
    icon: "/pwa/icon-192",
    badge: "/pwa/icon-192",
    tag: "routine-notification-test",
    data: { url: "/checkin" },
  });
}
