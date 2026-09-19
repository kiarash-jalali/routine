import { HealthClient } from "./HealthClient";
import { loadHealth } from "@/lib/db/health";
import { requireServerUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

type HealthData = Awaited<ReturnType<typeof loadHealth>>;

export default async function HealthPage() {
  const { supabase, userId } = await requireServerUser();
  let data: HealthData = { plans: [], reminders: [] };
  let initialLoadError = false;

  try {
    data = await loadHealth(userId, 100, supabase);
  } catch {
    initialLoadError = true;
  }

  return (
    <HealthClient
      userId={userId}
      initialData={data}
      initialLoadError={initialLoadError}
    />
  );
}
