import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type {
  PlanExercise,
  PlanExerciseInput,
  SetLog,
  SetLogInput,
} from "@/types/workout";

const exerciseColumns =
  "id,plan_id,user_id,position,name,target_sets,rep_scheme,rest_seconds,notes,archived_at";
const setLogColumns =
  "id,session_id,exercise_id,user_id,set_number,reps,weight_kg,band_level,rpe,completed_at";

/**
 * All of the user's exercises, archived ones included: an archived exercise is
 * hidden from the editor and new sessions but still shows the sets logged on it.
 */
export async function listUserExercises(
  userId: string,
  client?: SupabaseClient<Database>,
): Promise<PlanExercise[]> {
  const { data, error } = await (client ?? supabaseBrowser())
    .from("workout_plan_exercises")
    .select(exerciseColumns)
    .eq("user_id", userId)
    .order("plan_id")
    .order("position");
  if (error) throw new Error("workout_exercises_load_failed");
  return data ?? [];
}

/**
 * Saves the plan's exercise list in one transaction (`save_plan_exercises`).
 * Existing rows are updated in place; rows no longer in the list are archived
 * when they have logged sets (history stays) and deleted otherwise.
 */
export async function savePlanExercises(planId: string, rows: PlanExerciseInput[]) {
  const payload = rows.map((row) => ({
    ...(row.id ? { id: row.id } : {}),
    name: row.name.trim(),
    target_sets: row.target_sets,
    rep_scheme: row.rep_scheme.trim(),
    rest_seconds: row.rest_seconds,
    notes: row.notes,
  }));
  const { error } = await supabaseBrowser().rpc("save_plan_exercises", {
    p_plan_id: planId,
    p_exercises: payload,
  });
  if (error) throw new Error("workout_exercises_save_failed");
}

export async function listSetLogs(userId: string, sessionId: string): Promise<SetLog[]> {
  const { data, error } = await supabaseBrowser()
    .from("workout_set_logs")
    .select(setLogColumns)
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("set_number");
  if (error) throw new Error("workout_sets_load_failed");
  return data ?? [];
}

/**
 * Set logs of the most recent earlier session of the same plan that has any
 * logged sets (for prefill and the progression hint). Logging sets does not
 * complete a session, so completion is not required.
 */
export async function previousSetLogs(
  userId: string,
  planId: string,
  excludeSessionId: string,
): Promise<SetLog[]> {
  const db = supabaseBrowser();
  const { data: sessions, error } = await db
    .from("workout_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("workout_id", planId)
    .neq("id", excludeSessionId)
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: false })
    .limit(10);
  if (error) throw new Error("workout_sets_load_failed");
  const ids = (sessions ?? []).map((session) => session.id);
  if (!ids.length) return [];
  const { data: logs, error: logsError } = await db
    .from("workout_set_logs")
    .select(setLogColumns)
    .eq("user_id", userId)
    .in("session_id", ids)
    .order("set_number");
  if (logsError) throw new Error("workout_sets_load_failed");
  const latest = ids.find((id) => (logs ?? []).some((log) => log.session_id === id));
  return latest ? (logs ?? []).filter((log) => log.session_id === latest) : [];
}

export async function saveSetLog(userId: string, values: SetLogInput) {
  const { error } = await supabaseBrowser()
    .from("workout_set_logs")
    .upsert(
      { ...values, user_id: userId, completed_at: new Date().toISOString() },
      { onConflict: "session_id,exercise_id,set_number" },
    );
  if (error) throw new Error("workout_set_save_failed");
}

export async function deleteSetLog(
  userId: string,
  sessionId: string,
  exerciseId: string,
  setNumber: number,
) {
  const { error } = await supabaseBrowser()
    .from("workout_set_logs")
    .delete()
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .eq("exercise_id", exerciseId)
    .eq("set_number", setNumber);
  if (error) throw new Error("workout_set_save_failed");
}
