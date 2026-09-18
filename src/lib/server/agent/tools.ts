import "server-only";
import { z } from "zod";
import type { AgentRequestContext } from "./context";
const windowSchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .strict()
  .refine((value) => {
    const days = (Date.parse(value.to) - Date.parse(value.from)) / 86400000;
    return days >= 0 && days <= 31;
  });
export async function readPlanningSnapshot(
  context: AgentRequestContext,
  window: unknown,
) {
  const range = windowSchema.parse(window);
  const db = context.database,
    owner = context.userId;
  const [routines, tasks, checkins, workouts, sessions] = await Promise.all([
    db
      .from("routines")
      .select(
        "id,title,frequency,days_of_week,preferred_time,is_active,updated_at",
      )
      .eq("user_id", owner)
      .limit(100),
    db
      .from("tasks")
      .select("id,title,due_at,is_done,updated_at")
      .eq("user_id", owner)
      .eq("is_done", false)
      .limit(100),
    db
      .from("daily_checkins")
      .select("day")
      .eq("user_id", owner)
      .gte("day", range.from)
      .lte("day", range.to)
      .order("day"),
    db
      .from("workout_plans")
      .select(
        "id,name,activity_type,duration_minutes,days_of_week,preferred_time,timezone,is_active,updated_at",
      )
      .eq("user_id", owner)
      .limit(100),
    db
      .from("workout_sessions")
      .select("scheduled_day,duration_minutes,completed_at")
      .eq("user_id", owner)
      .gte("scheduled_day", range.from)
      .lte("scheduled_day", range.to)
      .limit(200),
  ]);
  if (
    [routines, tasks, checkins, workouts, sessions].some(
      (result) => result.error,
    )
  )
    throw new Error("agent_context_unavailable");
  // Excludes health tables, free-text notes, exercise notes, email and push subscriptions.
  return {
    range,
    routines: routines.data ?? [],
    tasks: tasks.data ?? [],
    checkinDays: (checkins.data ?? []).map((row) => row.day as string),
    workouts: workouts.data ?? [],
    sessions: sessions.data ?? [],
  };
}
export type PlanningSnapshot = Awaited<ReturnType<typeof readPlanningSnapshot>>;
