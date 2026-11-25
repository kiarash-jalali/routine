import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ADAPTIVE_SINCE,
  isAdaptiveCategory,
  isQuiet,
  type AdaptiveCategory,
} from "@/lib/adaptiveReminders";
import type { Database } from "@/types/database";

const CHUNK = 100;

/**
 * Quiet reminder categories per user. A failed chunk leaves its users out, so
 * they simply keep normal reminders.
 */
export async function loadQuietCategories(
  admin: SupabaseClient<Database>,
  userIds: string[],
): Promise<Map<string, Set<AdaptiveCategory>>> {
  const quiet = new Map<string, Set<AdaptiveCategory>>();
  for (let index = 0; index < userIds.length; index += CHUNK) {
    const { data, error } = await admin.rpc("reminder_recent_days", {
      p_users: userIds.slice(index, index + CHUNK),
      p_since: ADAPTIVE_SINCE,
    });
    if (error) continue;
    for (const row of data ?? []) {
      if (!isAdaptiveCategory(row.category) || !isQuiet(row.opened)) continue;
      const categories = quiet.get(row.user_id) ?? new Set<AdaptiveCategory>();
      categories.add(row.category);
      quiet.set(row.user_id, categories);
    }
  }
  return quiet;
}

/** For an already authenticated user's own page. */
export async function quietCategoriesForUser(userId: string): Promise<AdaptiveCategory[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return [...((await loadQuietCategories(admin, [userId])).get(userId) ?? [])];
}
