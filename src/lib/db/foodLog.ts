import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { dayFromNumber, dayNumber } from "@/lib/nutrition/body";
import type { LogDraft, MealSlot } from "@/lib/nutrition/log";

// Food log entries are health data (diet): never log them, put them in error
// messages, push payloads or snapshots. Errors carry codes only.
const entryColumns =
  "id,eaten_on,slot,source,food_id,recipe_id,portions,grams,label,kcal,protein,fat,carbs,note,created_at";
const profileColumns =
  "sex,birth_year,height_cm,activity_level,goal_mode,goal_weight_kg,goal_rate_kg_week,kcal_target_override,protein_mode,protein_grams,week_starts_on";

/** Weigh-ins read for the trend weight behind the targets. */
const WEIGHT_DAYS = 90;
const RECENT_ROWS = 200;
export const LOG_WEEK_DAYS = 7;

type Client = SupabaseClient<Database>;

export type FoodLogEntry = Omit<
  Database["public"]["Tables"]["food_log_entries"]["Row"],
  "user_id" | "updated_at" | "meal_plan_entry_id"
>;

/**
 * Everything the Today totals bar and the Log tab need for one day: profile and
 * weigh-ins for targets, accepted adjustments, the day's entries, the 7 days
 * ending that day (for the chart) and recent entries (for quick add).
 */
export async function loadFoodDay(userId: string, day: string, client?: Client) {
  const db = client ?? supabaseBrowser();
  const end = dayNumber(day);
  const [profile, weights, adjustments, week, recent] = await Promise.all([
    db.from("body_profiles").select(profileColumns).eq("user_id", userId).maybeSingle(),
    db
      .from("body_measurements")
      .select("measured_on,weight_kg")
      .eq("user_id", userId)
      .not("weight_kg", "is", null)
      .gte("measured_on", dayFromNumber(end - WEIGHT_DAYS))
      .lte("measured_on", day)
      .order("measured_on", { ascending: true }),
    db
      .from("target_adjustments")
      .select("effective_from,delta_kcal")
      .eq("user_id", userId)
      .lte("effective_from", day),
    db
      .from("food_log_entries")
      .select(entryColumns)
      .eq("user_id", userId)
      .gte("eaten_on", dayFromNumber(end - LOG_WEEK_DAYS + 1))
      .lte("eaten_on", day)
      .order("eaten_on", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1000),
    db
      .from("food_log_entries")
      .select(entryColumns)
      .eq("user_id", userId)
      .order("eaten_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(RECENT_ROWS),
  ]);
  if (profile.error || weights.error || adjustments.error || week.error || recent.error) {
    throw new Error("food_log_load_failed");
  }
  const weekEntries = (week.data ?? []) as FoodLogEntry[];
  return {
    day,
    profile: profile.data ?? null,
    weighIns: (weights.data ?? []).map((row) => ({
      day: row.measured_on,
      weightKg: Number(row.weight_kg),
    })),
    adjustments: adjustments.data ?? [],
    entries: weekEntries.filter((entry) => entry.eaten_on === day),
    week: weekEntries.map(({ eaten_on, kcal, protein }) => ({
      eaten_on,
      kcal: Number(kcal),
      protein: Number(protein),
    })),
    recent: (recent.data ?? []) as FoodLogEntry[],
  };
}

export type FoodDay = Awaited<ReturnType<typeof loadFoodDay>>;

export async function addLogEntry(userId: string, day: string, draft: LogDraft) {
  const { data, error } = await supabaseBrowser()
    .from("food_log_entries")
    .insert({ ...draft, user_id: userId, eaten_on: day })
    .select("id")
    .single();
  if (error || !data) throw new Error("food_log_save_failed");
  return data.id;
}

export type LogEntryUpdate = {
  slot: MealSlot;
  label: string;
  portions: number | null;
  grams: number | null;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

export async function updateLogEntry(userId: string, id: string, values: LogEntryUpdate) {
  const { error, count } = await supabaseBrowser()
    .from("food_log_entries")
    .update(values, { count: "exact" })
    .eq("id", id)
    .eq("user_id", userId);
  if (error || count === 0) throw new Error("food_log_save_failed");
}

export async function deleteLogEntry(userId: string, id: string) {
  const { error, count } = await supabaseBrowser()
    .from("food_log_entries")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", userId);
  if (error || count === 0) throw new Error("food_log_delete_failed");
}
