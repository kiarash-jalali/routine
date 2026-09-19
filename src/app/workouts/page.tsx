import { WorkoutsClient } from "./WorkoutsClient";
import { loadWorkouts } from "@/lib/db/workouts";
import { requireServerUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export default async function WorkoutsPage() {
  const { supabase, userId } = await requireServerUser();
  try {
    const data = await loadWorkouts(userId, 100, supabase);
    return <WorkoutsClient userId={userId} initialData={data} initialLoadError={false} />;
  } catch {
    return (
      <WorkoutsClient
        userId={userId}
        initialData={{ plans: [], sessions: [] }}
        initialLoadError
      />
    );
  }
}
