import { pageMetadata } from "@/lib/server/pageMetadata";
import { DashboardClient } from "./DashboardClient";
import { completionMapFromItems } from "@/lib/checkinProgress";
import { getDailyProgress } from "@/lib/db/checkins";
import { getRhythmSummary } from "@/lib/db/rhythm";
import { getNotificationPreference } from "@/lib/db/notifications";
import { listMedicationRemindersForDay } from "@/lib/db/health";
import { listWorkoutSessionsForDay } from "@/lib/db/workouts";
import { getWeighInState } from "@/lib/db/body";
import { loadFoodDay } from "@/lib/db/foodLog";
import { loadPlannedMeals } from "@/lib/db/mealPlan";
import { listTasks } from "@/lib/db/tasks";
import { listActiveRoutines } from "@/lib/db/today";
import { getServerLocalDay } from "@/lib/server/localDay";
import { quietCategoriesForUser } from "@/lib/server/reminderActivity";
import { requireServerUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("nav.today");
}

export default async function DashboardPage() {
  const { supabase, userId } = await requireServerUser();
  const initialDayKey = await getServerLocalDay();

  const [
    tasksResult,
    routinesResult,
    rhythmResult,
    progressResult,
    notificationPreferenceResult,
    healthResult,
    workoutsResult,
    weighInResult,
    foodResult,
    plannedResult,
    quietResult,
  ] = await Promise.allSettled([
    listTasks(supabase),
    listActiveRoutines(supabase),
    initialDayKey
      ? getRhythmSummary(initialDayKey, 7, supabase)
      : Promise.resolve(null),
    initialDayKey
      ? getDailyProgress(userId, initialDayKey, supabase)
      : Promise.resolve(null),
    getNotificationPreference(userId, supabase),
    initialDayKey
      ? listMedicationRemindersForDay(userId, initialDayKey, supabase)
      : Promise.resolve([]),
    initialDayKey
      ? listWorkoutSessionsForDay(userId, initialDayKey, supabase)
      : Promise.resolve([]),
    initialDayKey
      ? getWeighInState(userId, initialDayKey, supabase)
      : Promise.resolve(null),
    initialDayKey
      ? loadFoodDay(userId, initialDayKey, supabase)
      : Promise.resolve(null),
    initialDayKey
      ? loadPlannedMeals(userId, initialDayKey, supabase)
      : Promise.resolve(null),
    quietCategoriesForUser(userId),
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
  const initialNotificationPreference =
    notificationPreferenceResult.status === "fulfilled"
      ? notificationPreferenceResult.value
      : undefined;
  const initialMedicationReminders =
    healthResult.status === "fulfilled" ? healthResult.value : [];
  const initialWorkoutSessions =
    workoutsResult.status === "fulfilled" ? workoutsResult.value : [];
  // Optional card: a failed load just hides it, so it is not a partial error.
  const initialWeighIn =
    weighInResult.status === "fulfilled" ? weighInResult.value : null;
  const initialFoodDay =
    foodResult.status === "fulfilled" ? foodResult.value : null;
  const initialPlannedDay =
    plannedResult.status === "fulfilled" ? plannedResult.value : null;
  // Only categories that are still switched on are worth asking about.
  const initialQuietReminders =
    quietResult.status === "fulfilled" && initialNotificationPreference?.enabled
      ? quietResult.value.filter(
          (category) => initialNotificationPreference[`${category}_enabled`],
        )
      : [];

  return (
    <DashboardClient
      userId={userId}
      initialTasks={initialTasks}
      initialActiveRoutines={initialActiveRoutines}
      initialRhythm={initialRhythm}
      initialCompletionByItem={initialCompletionByItem}
      initialDayKey={initialDayKey}
      initialNotificationPreference={initialNotificationPreference}
      initialMedicationReminders={initialMedicationReminders}
      initialWorkoutSessions={initialWorkoutSessions}
      initialWeighIn={initialWeighIn}
      initialFoodDay={initialFoodDay}
      initialPlannedDay={initialPlannedDay}
      initialQuietReminders={initialQuietReminders}
      initialPartialError={[
        tasksResult,
        routinesResult,
        rhythmResult,
        progressResult,
        healthResult,
        workoutsResult,
      ].some((result) => result.status === "rejected")}
    />
  );
}
