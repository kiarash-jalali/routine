import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  sendReminderPush,
  type PushKind,
  type PushTarget,
  type ReminderCategory,
} from "./webPush";
import { isLanguage } from "@/lib/i18n";

export function reminderDelivery(admin: SupabaseClient<Database>) {
  const counts = { sent: 0, expired: 0, failed: 0 };
  const targets = new Map<string, PushTarget[]>();
  const languages = new Map<string, "en" | "fa">();

  async function deliver(
    userId: string,
    category: ReminderCategory,
    kind: PushKind,
    event: string,
    label?: string | null,
    notificationTagKey?: string | null,
  ) {
    if (!targets.has(userId)) {
      const [subscriptions, profile] = await Promise.all([
        admin
          .from("push_subscriptions")
          .select("id,endpoint,p256dh,auth")
          .eq("user_id", userId),
        admin
          .from("profiles")
          .select("locale")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      if (subscriptions.error || profile.error) {
        counts.failed++;
        return false;
      }

      targets.set(userId, subscriptions.data ?? []);
      languages.set(
        userId,
        isLanguage(profile.data?.locale) ? profile.data.locale : "en",
      );
    }

    let accepted = false;
    for (const target of targets.get(userId) ?? []) {
      const { data: claimed, error } = await admin.rpc("claim_push_delivery", {
        p_subscription: target.id,
        p_category: category,
        p_event: event,
      });

      if (error) {
        counts.failed++;
        continue;
      }
      if (!claimed) continue;

      const status = await sendReminderPush(
        target,
        kind,
        languages.get(userId) ?? "en",
        event,
        label,
        notificationTagKey,
      );

      if (status >= 200 && status < 300) {
        accepted = true;
        counts.sent++;
        const { error } = await admin
          .from("push_deliveries")
          .update({ delivered_at: new Date().toISOString() })
          .eq("subscription_id", target.id)
          .eq("category", category)
          .eq("event_key", event);
        if (error) counts.failed++;
      } else if (status === 404 || status === 410) {
        counts.expired++;
        await admin.from("push_subscriptions").delete().eq("id", target.id);
      } else {
        counts.failed++;
      }
    }

    return accepted;
  }

  return { counts, deliver };
}
