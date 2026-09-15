import { getLocalDateKey } from "@/lib/today";
import type { StreakMetrics } from "@/types/streak";

function dateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function previousDateKey(dateKey: string): string {
  const date = dateFromKey(dateKey);
  date.setDate(date.getDate() - 1);
  return getLocalDateKey(date);
}

function uniqueSortedDays(days: string[]): string[] {
  return [...new Set(days)].sort();
}

function longestRun(days: string[]): number {
  if (days.length === 0) return 0;

  let best = 1;
  let current = 1;

  for (let index = 1; index < days.length; index += 1) {
    if (previousDateKey(days[index]) === days[index - 1]) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  return best;
}

function currentRun(daySet: Set<string>, anchorDay: string): number {
  let count = 0;
  let cursor = anchorDay;

  while (daySet.has(cursor)) {
    count += 1;
    cursor = previousDateKey(cursor);
  }

  return count;
}

export function calculateStreakMetrics(
  checkinDays: string[],
  referenceDate = new Date(),
): StreakMetrics {
  const days = uniqueSortedDays(checkinDays);
  const daySet = new Set(days);
  const today = getLocalDateKey(referenceDate);
  const yesterday = previousDateKey(today);
  const checkedInToday = daySet.has(today);

  if (checkedInToday) {
    return {
      currentDays: currentRun(daySet, today),
      bestDays: longestRun(days),
      checkedInToday: true,
      state: "checked-in-today",
    };
  }

  if (daySet.has(yesterday)) {
    return {
      currentDays: currentRun(daySet, yesterday),
      bestDays: longestRun(days),
      checkedInToday: false,
      state: "open-today",
    };
  }

  return {
    currentDays: 0,
    bestDays: longestRun(days),
    checkedInToday: false,
    state: "inactive",
  };
}

export function streakMessage(metrics: StreakMetrics): string {
  if (metrics.state === "checked-in-today") {
    return "You showed up today. Completion does not need to be perfect for the rhythm to count.";
  }

  if (metrics.state === "open-today") {
    return "Your rhythm is still alive. A check-in today keeps it moving.";
  }

  return "A finished check-in today starts a new rhythm. The goal is returning, not being perfect.";
}

export function formatDayCount(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}
