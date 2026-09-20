import { getLocalDateKey, localDateFromKey } from "@/lib/today";
import type {
  CheckinHistoryEntry,
  CheckinHistorySummary,
  RhythmDay,
} from "@/types/history";

function localeMonthKey(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "numeric",
  }).format(date);
}

export type MonthCalendarDay = {
  dateKey: string;
  dayNumber: string | null;
  hidden: boolean;
  future: boolean;
  today: boolean;
  checkedIn: boolean;
  completionPercent: number;
};

export function formatHistoryDate(
  dateKey: string,
  locale = "en-AU",
): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(localDateFromKey(dateKey, 12));
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
  return history.filter((entry) => localDateFromKey(entry.day) >= earliest).length;
}

export function buildRhythmDays(
  history: CheckinHistoryEntry[],
  days = 14,
  referenceDate = new Date(),
  locale = "en-AU",
): RhythmDay[] {
  const historyByDay = new Map(history.map((entry) => [entry.day, entry]));
  const end = new Date(referenceDate);
  end.setHours(12, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (days - 1 - index));
    const dateKey = getLocalDateKey(date);
    const entry = historyByDay.get(dateKey);
    const summary = entry ? summarizeCheckin(entry) : null;

    return {
      dateKey,
      label: new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(date),
      checkedIn: Boolean(entry),
      completionPercent: summary?.completionPercent ?? 0,
      completedCount: summary?.completedCount ?? 0,
      totalCount: summary?.totalCount ?? 0,
    };
  });
}

export function buildMonthCalendarDays(
  history: CheckinHistoryEntry[],
  checkinDays: string[],
  referenceDate = new Date(),
  locale = "en-AU",
): MonthCalendarDay[] {
  const today = new Date(referenceDate);
  today.setHours(12, 0, 0, 0);
  const todayKey = getLocalDateKey(today);
  const targetMonth = localeMonthKey(today, locale);

  const monthStart = new Date(today);
  while (true) {
    const previous = new Date(monthStart);
    previous.setDate(previous.getDate() - 1);
    if (localeMonthKey(previous, locale) !== targetMonth) break;
    monthStart.setDate(monthStart.getDate() - 1);
  }

  const monthEnd = new Date(today);
  while (true) {
    const next = new Date(monthEnd);
    next.setDate(next.getDate() + 1);
    if (localeMonthKey(next, locale) !== targetMonth) break;
    monthEnd.setDate(monthEnd.getDate() + 1);
  }

  const firstCheckinKey = checkinDays[0] ?? todayKey;
  const historyByDay = new Map(history.map((entry) => [entry.day, entry]));
  const checkinSet = new Set(checkinDays);
  const leadingPlaceholders = (monthStart.getDay() + 6) % 7;
  const cells: MonthCalendarDay[] = Array.from(
    { length: leadingPlaceholders },
    (_, index) => ({
      dateKey: `placeholder-${index}`,
      dayNumber: null,
      hidden: true,
      future: false,
      today: false,
      checkedIn: false,
      completionPercent: 0,
    }),
  );

  const dayFormatter = new Intl.DateTimeFormat(locale, { day: "numeric" });
  for (
    const cursor = new Date(monthStart);
    cursor <= monthEnd;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const date = new Date(cursor);
    const dateKey = getLocalDateKey(date);
    const entry = historyByDay.get(dateKey);
    const summary = entry ? summarizeCheckin(entry) : null;

    cells.push({
      dateKey,
      dayNumber: dayFormatter.format(date),
      hidden: dateKey < firstCheckinKey,
      future: dateKey > todayKey,
      today: dateKey === todayKey,
      checkedIn: checkinSet.has(dateKey),
      completionPercent: summary?.completionPercent ?? 0,
    });
  }

  return cells;
}
