import { translate, type Language } from "@/lib/i18n";
import {
  removePushSubscription,
  savePushSubscription,
  type StoredPushSubscription,
} from "@/lib/db/notifications";

const PUSH_ENDPOINT_KEY = "rootine-push-endpoint";
const PUSH_INTENT_KEY = "rootine-push-intent";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function applicationServerKeyMatches(
  subscription: PushSubscription,
  expected: Uint8Array,
) {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const actual = new Uint8Array(current);
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function rememberedEndpoint() {
  try {
    return localStorage.getItem(PUSH_ENDPOINT_KEY);
  } catch {
    return null;
  }
}

function pushIntent() {
  try {
    return localStorage.getItem(PUSH_INTENT_KEY);
  } catch {
    return null;
  }
}

function rememberEnabledEndpoint(endpoint: string) {
  try {
    localStorage.setItem(PUSH_ENDPOINT_KEY, endpoint);
    localStorage.setItem(PUSH_INTENT_KEY, "enabled");
  } catch {
    // Browser subscription still works when storage is unavailable.
  }
}

function rememberDisabledDevice() {
  try {
    localStorage.removeItem(PUSH_ENDPOINT_KEY);
    localStorage.setItem(PUSH_INTENT_KEY, "disabled");
  } catch {
    // The browser subscription is still removed below.
  }
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

async function ensureBrowserPushSubscription(requestPermission: boolean) {
  if (!notificationsSupported()) {
    throw new Error("Notifications are not supported on this device.");
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Push notifications are not configured.");

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : requestPermission
        ? await Notification.requestPermission()
        : Notification.permission;

  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await getServiceWorkerRegistration();
  const expectedKey = decodeBase64Url(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  let replacedEndpoint: string | null = null;

  if (subscription && !applicationServerKeyMatches(subscription, expectedKey)) {
    replacedEndpoint = subscription.endpoint;
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: expectedKey,
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
    replacedEndpoint,
  };
}

async function persistPushSubscription(
  userId: string,
  subscription: StoredPushSubscription,
  replacedEndpoint: string | null,
) {
  const previousEndpoint = rememberedEndpoint() ?? replacedEndpoint;
  await savePushSubscription(userId, subscription);

  if (previousEndpoint && previousEndpoint !== subscription.endpoint) {
    await removePushSubscription(previousEndpoint).catch(() => undefined);
  }

  rememberEnabledEndpoint(subscription.endpoint);
}

export async function enablePushNotifications(userId: string) {
  const result = await ensureBrowserPushSubscription(true);
  await persistPushSubscription(
    userId,
    result.storedSubscription,
    result.replacedEndpoint,
  );
  return result;
}

export type PushHealth =
  | "healthy"
  | "disabled"
  | "unsupported"
  | "permission-required"
  | "blocked";

export async function reconcilePushNotifications(
  userId: string,
  dailyPreferenceEnabled: boolean,
): Promise<PushHealth> {
  if (!notificationsSupported()) return "unsupported";
  if (pushIntent() === "disabled") return "disabled";

  const registration = await navigator.serviceWorker.getRegistration("/");
  const existingSubscription =
    await registration?.pushManager.getSubscription();
  const shouldHavePush =
    pushIntent() === "enabled" ||
    dailyPreferenceEnabled ||
    Boolean(existingSubscription);

  if (!shouldHavePush) return "disabled";

  if (Notification.permission !== "granted") {
    const endpoint = rememberedEndpoint() ?? existingSubscription?.endpoint;
    if (endpoint) {
      await removePushSubscription(endpoint).catch(() => undefined);
    }
    return Notification.permission === "denied"
      ? "blocked"
      : "permission-required";
  }

  const result = await ensureBrowserPushSubscription(false);
  await persistPushSubscription(
    userId,
    result.storedSubscription,
    result.replacedEndpoint,
  );
  return "healthy";
}

export async function disablePushNotifications() {
  const previousEndpoint = rememberedEndpoint();
  rememberDisabledDevice();
  if (!notificationsSupported()) return previousEndpoint;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  const endpoint = subscription?.endpoint ?? previousEndpoint;
  if (subscription) await subscription.unsubscribe();
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
