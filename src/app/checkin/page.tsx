import { CheckinClient } from "./CheckinClient";
import { completionMapFromItems, tasksForDailyCheckin } from "@/lib/checkinProgress";
import { findDailyCheckin, listCheckinItems } from "@/lib/db/checkins";
import { listTasks } from "@/lib/db/tasks";
import { listTodaysRoutines } from "@/lib/db/today";
import { getServerLocalDay } from "@/lib/server/localDay";
import { requireServerUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const { supabase, userId } = await requireServerUser();
  const initialDayKey = await getServerLocalDay();

  if (!initialDayKey) {
    return (
      <CheckinClient
        userId={userId}
        initialDayKey={null}
        initialRoutines={[]}
        initialTasks={[]}
        initialCompletionByItem={{}}
        initialFinished={false}
        initialLoadError={false}
      />
    );
  }

  try {
    const dayDate = new Date(`${initialDayKey}T12:00:00`);
    const [routines, allTasks, checkin] = await Promise.all([
      listTodaysRoutines(dayDate, supabase),
      listTasks(supabase),
      findDailyCheckin(userId, initialDayKey, supabase),
    ]);
    const items = checkin ? await listCheckinItems(checkin.id, supabase) : [];

    return (
      <CheckinClient
        userId={userId}
        initialDayKey={initialDayKey}
        initialRoutines={routines}
        initialTasks={tasksForDailyCheckin(allTasks, items, dayDate)}
        initialCompletionByItem={completionMapFromItems(items)}
        initialFinished={Boolean(checkin?.completed_at)}
        initialLoadError={false}
      />
    );
  } catch {
    return (
      <CheckinClient
        userId={userId}
        initialDayKey={initialDayKey}
        initialRoutines={[]}
        initialTasks={[]}
        initialCompletionByItem={{}}
        initialFinished={false}
        initialLoadError
      />
    );
  }
}
