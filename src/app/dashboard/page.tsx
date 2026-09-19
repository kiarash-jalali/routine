import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardClient } from "./DashboardClient";
import { completionMapFromItems } from "@/lib/checkinProgress";
import { getDailyProgress } from "@/lib/db/checkins";
import { getRhythmSummary } from "@/lib/db/rhythm";
import { listTasks } from "@/lib/db/tasks";
import { listActiveRoutines } from "@/lib/db/today";
import { supabaseServer } from "@/lib/supabase/server";
import {
  dateKeyInTimeZone,
  isTimeZone,
  ROOTINE_TIMEZONE_COOKIE,
} from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  const userId =
    typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (error || !userId) redirect("/login");

  const cookieStore = await cookies();
  const encodedTimeZone = cookieStore.get(ROOTINE_TIMEZONE_COOKIE)?.value;
  let timeZone: string | null = null;
  if (encodedTimeZone) {
    try {
      timeZone = decodeURIComponent(encodedTimeZone);
    } catch {
      timeZone = null;
    }
  }

  const initialDayKey =
    timeZone && isTimeZone(timeZone) ? dateKeyInTimeZone(timeZone) : null;

  const [tasksResult, routinesResult, rhythmResult, progressResult] =
    await Promise.allSettled([
      listTasks(supabase),
      listActiveRoutines(supabase),
      initialDayKey
        ? getRhythmSummary(initialDayKey, 7, supabase)
        : Promise.resolve(null),
      initialDayKey
        ? getDailyProgress(userId, initialDayKey, supabase)
        : Promise.resolve(null),
    ]);

  const initialTasks =
    tasksResult.status === "fulfilled" ? tasksResult.value : [];
  const initialActiveRoutines =
    routinesResult.status === "fulfilled" ? routinesResult.value : [];
  const initialRhythm =
    rhythmResult.status === "fulfilled" ? rhythmResult.value : null;
  const initialCompletionByItem =
    progressResult.status === "fulfilled" && progressResult.value
      ? completionMapFromItems(progressResult.value.items)
      : {};

  return (
    <DashboardClient
      userId={userId}
      initialTasks={initialTasks}
      initialActiveRoutines={initialActiveRoutines}
      initialRhythm={initialRhythm}
      initialCompletionByItem={initialCompletionByItem}
      initialDayKey={initialDayKey}
      initialPartialError={[
        tasksResult,
        routinesResult,
        rhythmResult,
        progressResult,
      ].some((result) => result.status === "rejected")}
    />
  );
}
