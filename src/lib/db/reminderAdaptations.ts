import { KEEP_DAYS, type AdaptiveCategory } from "@/lib/adaptiveReminders";
import { saveNotificationPreference } from "@/lib/db/notifications";
import { supabaseBrowser } from "@/lib/supabaseClient";

async function countFrom(userId: string, category: AdaptiveCategory, days: number) {
  const { error } = await supabaseBrowser()
    .from("reminder_adaptations")
    .upsert(
      {
        user_id: userId,
        category,
        counted_from: new Date(Date.now() + days * 86400000).toISOString(),
      },
      { onConflict: "user_id,category" },
    );
  if (error) throw new Error("reminder_adaptation_save_failed");
}

/** Normal frequency again, and don't ask for a while. */
export const keepReminders = (userId: string, category: AdaptiveCategory) =>
  countFrom(userId, category, KEEP_DAYS);

/** Normal frequency again, counting from now. */
export const restartReminders = (userId: string, category: AdaptiveCategory) =>
  countFrom(userId, category, 0);

/** Same switch as Settings; turning it back on later starts a fresh count. */
export async function pauseReminders(userId: string, category: AdaptiveCategory) {
  await saveNotificationPreference(userId, { [`${category}_enabled`]: false });
  await restartReminders(userId, category).catch(() => undefined);
}
