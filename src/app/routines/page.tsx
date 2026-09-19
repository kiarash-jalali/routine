import { RoutinesClient } from "./RoutinesClient";
import { listRoutines } from "@/lib/db/routines";
import { requireServerUser } from "@/lib/supabase/requireUser";
import type { Routine } from "@/types/routine";

export const dynamic = "force-dynamic";

export default async function RoutinesPage() {
  const { supabase, userId } = await requireServerUser();
  let routines: Routine[] = [];
  let initialLoadError = false;

  try {
    routines = await listRoutines(supabase);
  } catch {
    initialLoadError = true;
  }

  return (
    <RoutinesClient
      userId={userId}
      initialRoutines={routines}
      initialLoadError={initialLoadError}
    />
  );
}
