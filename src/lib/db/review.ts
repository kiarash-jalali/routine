import type { SupabaseClient } from "@supabase/supabase-js";
import { dayFromNumber, dayNumber, defaultWeekStart } from "@/lib/nutrition/body";
import { reviewWeek } from "@/lib/nutrition/review";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Database } from "@/types/database";

// Health data: never log these values or put them in error messages, push
// payloads or snapshots. Errors carry codes only.
const profileColumns =
  "sex,birth_year,height_cm,activity_level,goal_mode,goal_weight_kg,goal_rate_kg_week,kcal_target_override,protein_mode,protein_grams,week_starts_on";
// Same window as Today (foodLog.ts), so both show the same target.
const WEIGHT_DAYS = 90;

/** Everything `/review` shows for the last completed week before `today`. */
export async function loadReview(
  userId: string,
  today: string,
  client?: SupabaseClient<Database>,
) {
  const db = client ?? supabaseBrowser();
  const [profile, account] = await Promise.all([
    db.from("body_profiles").select(profileColumns).eq("user_id", userId).maybeSingle(),
    db.from("profiles").select("locale").eq("user_id", userId).maybeSingle(),
  ]);
  if (profile.error || account.error) throw new Error("review_load_failed");
  const week = reviewWeek(
    today,
    profile.data?.week_starts_on ?? defaultWeekStart(account.data?.locale ?? "en"),
  );

  const [weights, adjustments, food, workouts, checkins, dismissal] = await Promise.all([
    db
      .from("body_measurements")
      .select("measured_on,weight_kg")
      .eq("user_id", userId)
      .not("weight_kg", "is", null)
      .gte("measured_on", dayFromNumber(dayNumber(today) - WEIGHT_DAYS))
      .lte("measured_on", today)
      .order("measured_on"),
    db
      .from("target_adjustments")
      .select("effective_from,delta_kcal,review_week")
      .eq("user_id", userId)
      .lte("effective_from", today),
    db
      .from("food_log_entries")
      .select("eaten_on,kcal,protein")
      .eq("user_id", userId)
      .gte("eaten_on", week.start)
      .lte("eaten_on", week.end)
      .limit(1000),
    db
      .from("workout_sessions")
      .select("id")
      .eq("user_id", userId)
      .gte("scheduled_day", week.start)
      .lte("scheduled_day", week.end)
      .not("completed_at", "is", null),
    db
      .from("daily_checkins")
      .select("id")
      .eq("user_id", userId)
      .gte("day", week.start)
      .lte("day", week.end),
    db
      .from("review_dismissals")
      .select("week_start")
      .eq("user_id", userId)
      .eq("week_start", week.start)
      .maybeSingle(),
  ]);
  if (
    weights.error ||
    adjustments.error ||
    food.error ||
    workouts.error ||
    checkins.error ||
    dismissal.error
  ) {
    throw new Error("review_load_failed");
  }

  let routinesDone = 0;
  const checkinIds = checkins.data.map((row) => row.id);
  if (checkinIds.length > 0) {
    const { count, error } = await db
      .from("checkin_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("checkin_id", checkinIds)
      .eq("item_type", "routine")
      .eq("completed", true);
    if (error) throw new Error("review_load_failed");
    routinesDone = count ?? 0;
  }

  return {
    today,
    week,
    profile: profile.data ?? null,
    weighIns: weights.data.map((row) => ({
      day: row.measured_on,
      weightKg: Number(row.weight_kg),
    })),
    adjustments: adjustments.data,
    food: food.data.map((row) => ({
      eaten_on: row.eaten_on,
      kcal: Number(row.kcal),
      protein: Number(row.protein),
    })),
    workoutsDone: workouts.data.length,
    routinesDone,
    accepted: adjustments.data.find((row) => row.review_week === week.start) ?? null,
    dismissed: Boolean(dismissal.data),
  };
}

export type ReviewData = Awaited<ReturnType<typeof loadReview>>;

export async function acceptSuggestion(
  userId: string,
  week: string,
  today: string,
  deltaKcal: number,
) {
  const { error } = await supabaseBrowser().from("target_adjustments").insert({
    user_id: userId,
    effective_from: today,
    delta_kcal: deltaKcal,
    reason: "weekly_review",
    review_week: week,
  });
  // Already accepted (double tap or another device): nothing more to do.
  if (error && error.code !== "23505") throw new Error("review_accept_failed");
}

export async function undoSuggestion(userId: string, week: string) {
  const { error } = await supabaseBrowser()
    .from("target_adjustments")
    .delete()
    .eq("user_id", userId)
    .eq("review_week", week);
  if (error) throw new Error("review_undo_failed");
}

export async function dismissSuggestion(userId: string, week: string) {
  const { error } = await supabaseBrowser()
    .from("review_dismissals")
    .upsert({ user_id: userId, week_start: week }, { onConflict: "user_id,week_start" });
  if (error) throw new Error("review_dismiss_failed");
}
