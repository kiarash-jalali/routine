import { HealthClient } from "./HealthClient";
import { loadHealth } from "@/lib/db/health";
import { requireServerUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const { supabase, userId } = await requireServerUser();
  try {
    const data = await loadHealth(userId, 100, supabase);
    return <HealthClient userId={userId} initialData={data} initialLoadError={false} />;
  } catch {
    return (
      <HealthClient
        userId={userId}
        initialData={{ plans: [], reminders: [] }}
        initialLoadError
      />
    );
  }
}
