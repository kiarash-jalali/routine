import "server-only";
import webpush from "web-push";
import { isValidPushEndpoint } from "@/lib/pushEndpoint";
import { translate, type Language } from "@/lib/i18n";

export type ReminderCategory = "checkin" | "health" | "workout";
export type PushKind =
  | "checkin"
  | "checkin_missed"
  | "task"
  | "routine"
  | "health"
  | "workout";

export type PushTarget = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function notificationBody(kind: PushKind, language: Language) {
  if (kind === "health") return translate(language, "reminder.genericHealth");
  if (kind === "workout")
    return translate(language, "reminder.genericWorkout");
  if (kind === "checkin_missed")
    return translate(language, "reminder.missedCheckin");
  return translate(language, "reminder.generic");
}

function notificationUrl(kind: PushKind) {
  if (kind === "health") return "/health";
  if (kind === "workout") return "/workouts";
  if (kind === "checkin" || kind === "checkin_missed") return "/checkin";
  return "/dashboard";
}

export async function sendReminderPush(
  target: PushTarget,
  kind: PushKind,
  language: Language,
  eventKey: string,
) {
  if (!isValidPushEndpoint(target.endpoint)) return 400;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject)
    throw new Error("push_configuration_missing");

  try {
    const result = await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify({
        body: notificationBody(kind, language),
        url: notificationUrl(kind),
        tag: `rootine-${kind}-${eventKey}`.slice(0, 128),
        lang: language,
        dir: language === "fa" ? "rtl" : "ltr",
      }),
      {
        TTL: 300,
        urgency: kind === "health" ? "high" : "normal",
        timeout: 5000,
        vapidDetails: { subject, publicKey, privateKey },
      },
    );
    return result.statusCode;
  } catch (error: unknown) {
    // Never log endpoint, encrypted payload or provider error body.
    return error &&
      typeof error === "object" &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
      ? error.statusCode
      : 503;
  }
}
