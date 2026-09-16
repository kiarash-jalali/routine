import { supabaseBrowser } from "@/lib/supabaseClient";

export type NotificationPreference = {
  user_id: string;
  enabled: boolean;
  reminder_time: string;
  timezone: string;
  last_sent_on: string | null;
};

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
    .maybeSingle<NotificationPreference>();

  if (error) throw error;
  return data;
}

export async function saveNotificationPreference(
  userId: string,
  values: Pick<NotificationPreference, "enabled" | "reminder_time" | "timezone">,
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

export async function savePushSubscription(
  userId: string,
  subscription: StoredPushSubscription,
) {
  const { error } = await supabaseBrowser()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        ...subscription,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

  if (error) throw error;
}

export async function removePushSubscription(endpoint: string) {
  const { error } = await supabaseBrowser()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) throw error;
}
