import { pageMetadata } from "@/lib/server/pageMetadata";
import { CheckinClient } from "./CheckinClient";
import { completionMapFromItems, tasksForDailyCheckin } from "@/lib/checkinProgress";
import { findDailyCheckin, listCheckinItems } from "@/lib/db/checkins";
import { listTasks } from "@/lib/db/tasks";
import { listTodaysRoutines } from "@/lib/db/today";
import { getServerLocalDay } from "@/lib/server/localDay";
import { requireServerUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("nav.checkin");
}

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

  const dayDate = new Date(`${initialDayKey}T12:00:00`);
  let loaded: {
    routines: Awaited<ReturnType<typeof listTodaysRoutines>>;
    tasks: ReturnType<typeof tasksForDailyCheckin>;
    completionByItem: ReturnType<typeof completionMapFromItems>;
    finished: boolean;
  } | null = null;

  try {
    const [routines, allTasks, checkin] = await Promise.all([
      listTodaysRoutines(dayDate, supabase),
      listTasks(supabase),
      findDailyCheckin(userId, initialDayKey, supabase),
    ]);
    const items = checkin ? await listCheckinItems(checkin.id, supabase) : [];
    loaded = {
      routines,
      tasks: tasksForDailyCheckin(allTasks, items, dayDate),
      completionByItem: completionMapFromItems(items),
      finished: Boolean(checkin?.completed_at),
    };
  } catch {
    loaded = null;
  }

  return (
    <CheckinClient
      userId={userId}
      initialDayKey={initialDayKey}
      initialRoutines={loaded?.routines ?? []}
      initialTasks={loaded?.tasks ?? []}
      initialCompletionByItem={loaded?.completionByItem ?? {}}
      initialFinished={loaded?.finished ?? false}
      initialLoadError={loaded === null}
    />
  );
}
