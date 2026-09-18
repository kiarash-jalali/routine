import "server-only";
import webpush from "web-push";
import { isValidPushEndpoint } from "@/lib/pushEndpoint";
import { translate, type Language } from "@/lib/i18n";
export type ReminderCategory = "checkin" | "health" | "workout";
export type PushTarget = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};
export async function sendReminderPush(
  target: PushTarget,
  category: ReminderCategory,
  language: Language,
) {
  if (!isValidPushEndpoint(target.endpoint)) return 400;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey = process.env.VAPID_PRIVATE_KEY,
    subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject)
    throw new Error("push_configuration_missing");
  // No user-entered content is accepted by this transport interface.
  const body = translate(
    language,
    category === "health"
      ? "reminder.genericHealth"
      : category === "workout"
        ? "reminder.genericWorkout"
        : "reminder.generic",
  );
  try {
    const result = await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify({
        body,
        url:
          category === "health"
            ? "/health"
            : category === "workout"
              ? "/workouts"
              : "/checkin",
        tag: `rootine-${category}`,
        lang: language,
        dir: language === "fa" ? "rtl" : "ltr",
      }),
      {
        TTL: 300,
        urgency: "normal",
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
