import { HistoryClient } from "./HistoryClient";
import { listCheckinDays, listRecentCheckinHistory } from "@/lib/db/history";
import { getPointBalance, listStreakRepairs } from "@/lib/db/points";
import { requireServerUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { supabase, userId } = await requireServerUser();
  const [history, days, repairs, balance] = await Promise.allSettled([
    listRecentCheckinHistory(userId, 30, supabase),
    listCheckinDays(userId, supabase),
    listStreakRepairs(userId, supabase),
    getPointBalance(supabase),
  ]);

  return (
    <HistoryClient
      initialHistory={history.status === "fulfilled" ? history.value : []}
      initialCheckinDays={days.status === "fulfilled" ? days.value : []}
      initialRepairs={repairs.status === "fulfilled" ? repairs.value : []}
      initialPointBalance={balance.status === "fulfilled" ? balance.value : 0}
      initialLoadError={[history, days, repairs, balance].some(
        (result) => result.status === "rejected",
      )}
    />
  );
}
