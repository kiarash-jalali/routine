import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { SessionInput, WorkoutInput } from "@/types/workout";
const planColumns =
  "id,user_id,name,activity_type,duration_minutes,exercises,days_of_week,preferred_time,timezone,is_active,reminders_enabled,created_at,updated_at";
const sessionColumns =
  "id,user_id,workout_id,name,activity_type,duration_minutes,exercises,scheduled_day,scheduled_time,scheduled_at,timezone,completed_at";
export async function loadWorkouts(
  userId: string,
  limit = 100,
  client?: SupabaseClient<Database>,
) {
  const db = client ?? supabaseBrowser();
  const [plans, sessions] = await Promise.all([
    db
      .from("workout_plans")
      .select(planColumns)
      .eq("user_id", userId)
      .order("created_at"),
    db
      .from("workout_sessions")
      .select(sessionColumns)
      .eq("user_id", userId)
      .order("scheduled_at", { ascending: false })
      .limit(limit),
  ]);
  if (plans.error || sessions.error) throw new Error("workout_load_failed");
  return {
    plans: plans.data ?? [],
    sessions: sessions.data ?? [],
  };
}
export async function listWorkoutSessionsForDay(
  userId: string,
  day: string,
  client?: SupabaseClient<Database>,
) {
  const { data, error } = await (client ?? supabaseBrowser())
    .from("workout_sessions")
    .select(sessionColumns)
    .eq("user_id", userId)
    .eq("scheduled_day", day)
    .order("scheduled_at");

  if (error) throw new Error("workout_today_load_failed");
  return data ?? [];
}

export async function saveWorkout(
  userId: string,
  values: WorkoutInput,
  id?: string,
) {
  const db = supabaseBrowser();
  const { error } = await (id
    ? db.from("workout_plans").update(values).eq("id", id).eq("user_id", userId)
    : db.from("workout_plans").insert({ ...values, user_id: userId }));
  if (error) throw new Error("workout_save_failed");

  const { error: syncError } = await db.rpc("sync_workout_sessions", {
    target_user_id: userId,
  });
  if (syncError) throw new Error("workout_sync_failed");
}
export async function setWorkoutActive(
  userId: string,
  id: string,
  active: boolean,
) {
  const db = supabaseBrowser();
  const { error } = await db
    .from("workout_plans")
    .update({ is_active: active })
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error("workout_update_failed");

  const { error: syncError } = await db.rpc("sync_workout_sessions", {
    target_user_id: userId,
  });
  if (syncError) throw new Error("workout_sync_failed");
}
export async function completeWorkout(
  userId: string,
  id: string,
  completed: boolean,
  duration: number,
) {
  const { error } = await supabaseBrowser()
    .from("workout_sessions")
    .update({
      completed_at: completed ? new Date().toISOString() : null,
      duration_minutes: duration,
    })
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error("workout_completion_failed");
}
export async function logWorkout(userId: string, values: SessionInput) {
  const { error } = await supabaseBrowser()
    .from("workout_sessions")
    .insert({ ...values, user_id: userId, completed_at: values.scheduled_at });
  if (error) throw new Error("workout_log_failed");
}
