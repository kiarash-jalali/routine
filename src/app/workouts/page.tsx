import { pageMetadata } from "@/lib/server/pageMetadata";
import { WorkoutsClient } from "./WorkoutsClient";
import { loadWorkouts } from "@/lib/db/workouts";
import { requireServerUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("nav.workouts");
}

type WorkoutData = Awaited<ReturnType<typeof loadWorkouts>>;

export default async function WorkoutsPage() {
  const { supabase, userId } = await requireServerUser();
  let data: WorkoutData = { plans: [], sessions: [], exercises: [], exercisesFailed: false };
  let initialLoadError = false;

  try {
    data = await loadWorkouts(userId, 100, supabase);
  } catch {
    initialLoadError = true;
  }

  return (
    <WorkoutsClient
      userId={userId}
      initialData={data}
      initialLoadError={initialLoadError}
    />
  );
}
