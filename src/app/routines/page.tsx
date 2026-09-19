import { RoutinesClient } from "./RoutinesClient";
import { listRoutines } from "@/lib/db/routines";
import { requireServerUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export default async function RoutinesPage() {
  const { supabase, userId } = await requireServerUser();

  try {
    const routines = await listRoutines(supabase);
    return (
      <RoutinesClient
        userId={userId}
        initialRoutines={routines}
        initialLoadError={false}
      />
    );
  } catch {
    return (
      <RoutinesClient
        userId={userId}
        initialRoutines={[]}
        initialLoadError
      />
    );
  }
}
