import { getLocalDateKey } from "@/lib/today";
import type {
  CheckinHistoryEntry,
  CheckinHistorySummary,
  RhythmDay,
} from "@/types/history";

function dateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatHistoryDate(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(dateFromKey(dateKey));
}

export function summarizeCheckin(
  entry: CheckinHistoryEntry,
): CheckinHistorySummary {
  const routineItems = entry.items.filter((item) => item.item_type === "routine");
  const taskItems = entry.items.filter((item) => item.item_type === "task");
  const completedItems = entry.items.filter((item) => item.completed);

  const totalCount = entry.items.length;
  const completedCount = completedItems.length;

  return {
    completedCount,
    totalCount,
    completionPercent:
      totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    routineCompletedCount: routineItems.filter((item) => item.completed).length,
    routineTotalCount: routineItems.length,
    taskCompletedCount: taskItems.filter((item) => item.completed).length,
    taskTotalCount: taskItems.length,
  };
}

export function averageCompletionPercent(
  history: CheckinHistoryEntry[],
): number {
  const summariesWithItems = history
    .map(summarizeCheckin)
    .filter((summary) => summary.totalCount > 0);

  if (summariesWithItems.length === 0) return 0;

  const total = summariesWithItems.reduce(
    (sum, summary) => sum + summary.completionPercent,
    0,
  );

  return Math.round(total / summariesWithItems.length);
}

export function countRecentCheckins(
  history: CheckinHistoryEntry[],
  days: number,
  referenceDate = new Date(),
): number {
  const earliest = new Date(referenceDate);
  earliest.setHours(0, 0, 0, 0);
  earliest.setDate(earliest.getDate() - (days - 1));

  return history.filter((entry) => dateFromKey(entry.day) >= earliest).length;
}

export function buildRhythmDays(
  history: CheckinHistoryEntry[],
  days = 14,
  referenceDate = new Date(),
): RhythmDay[] {
  const historyByDay = new Map(history.map((entry) => [entry.day, entry]));
  const end = new Date(referenceDate);
  end.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const dayOffset = days - 1 - index;
    const date = new Date(end);
    date.setDate(end.getDate() - dayOffset);
    const dateKey = getLocalDateKey(date);
    const entry = historyByDay.get(dateKey);
    const summary = entry ? summarizeCheckin(entry) : null;

    return {
      dateKey,
      label: new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(
        date,
      ),
      checkedIn: Boolean(entry),
      completionPercent: summary?.completionPercent ?? 0,
      completedCount: summary?.completedCount ?? 0,
      totalCount: summary?.totalCount ?? 0,
    };
  });
}
