import { DashboardClient } from "./DashboardClient";
import { completionMapFromItems } from "@/lib/checkinProgress";
import { getDailyProgress } from "@/lib/db/checkins";
import { getRhythmSummary } from "@/lib/db/rhythm";
import { listTasks } from "@/lib/db/tasks";
import { listActiveRoutines } from "@/lib/db/today";
import { getServerLocalDay } from "@/lib/server/localDay";
import { requireServerUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, userId } = await requireServerUser();
  const initialDayKey = await getServerLocalDay();

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
