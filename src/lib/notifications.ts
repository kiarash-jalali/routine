import { translate, type Language } from "@/lib/i18n";
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
  if (existing?.active) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export async function enablePushNotifications() {
  if (!notificationsSupported()) {
    throw new Error("Notifications are not supported on this device.");
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Push notifications are not configured.");
  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error("Notification permission was not granted.");

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

export async function showNotificationTest(language: Language = "en") {
  const registration = await getServiceWorkerRegistration();
  await registration.showNotification("rootine", {
    body: translate(language, "reminder.test"),
    icon: "/pwa/icon-192",
    badge: "/pwa/icon-192",
    tag: "routine-notification-test",
    data: { url: "/checkin" },
  });
}


export function iosPushRequiresInstall(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return false;

  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    navigatorWithStandalone.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  return isIos && !standalone;
}
