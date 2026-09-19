import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Tables } from "@/types/database";

export type NotificationPreference = Pick<
  Tables<"notification_preferences">,
  "user_id" | "enabled" | "reminder_time" | "timezone" | "last_sent_on"
>;

export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function getNotificationPreference(userId: string) {
  const { data, error } = await supabaseBrowser()
    .from("notification_preferences")
    .select("user_id, enabled, reminder_time, timezone, last_sent_on")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function syncNotificationPreferenceTimezone(
  userId: string,
  timezone: string,
) {
  const { error } = await supabaseBrowser()
    .from("notification_preferences")
    .update({
      timezone,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .neq("timezone", timezone);

  if (error) throw error;
}

export async function saveNotificationPreference(
  userId: string,
  values: Pick<
    NotificationPreference,
    "enabled" | "reminder_time" | "timezone"
  >,
) {
  const { error } = await supabaseBrowser()
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        ...values,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) throw error;
}

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await supabaseBrowser().auth.getSession();

  if (error) throw error;
  if (!session?.access_token) {
    throw new Error("Your session has expired. Log in again.");
  }

  return session.access_token;
}

async function readApiError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return payload?.error ?? fallback;
}

export async function savePushSubscription(
  userId: string,
  subscription: StoredPushSubscription,
) {
  if (!userId) throw new Error("You must be signed in to enable reminders.");

  const accessToken = await getAccessToken();
  const response = await fetch("/api/notifications/subscription", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(subscription),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "The push subscription could not be saved."),
    );
  }
}

export async function removePushSubscription(endpoint: string) {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/notifications/subscription", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ endpoint }),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "The push subscription could not be removed.",
      ),
    );
  }
}
