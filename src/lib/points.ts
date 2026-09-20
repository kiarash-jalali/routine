import { getLocalDateKey } from "@/lib/today";

function dateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function nextDateKey(dateKey: string): string {
  const date = dateFromKey(dateKey);
  date.setDate(date.getDate() + 1);
  return getLocalDateKey(date);
}

export function findRepairableDays(
  checkinDays: string[],
  repairedDays: string[] = [],
): string[] {
  const sortedCheckins = [...new Set(checkinDays)].sort();
  const repairedDaySet = new Set(repairedDays);
  const repairable: string[] = [];

  for (let index = 1; index < sortedCheckins.length; index += 1) {
    const previousCheckin = sortedCheckins[index - 1];
    const nextCheckin = sortedCheckins[index];
    let cursor = nextDateKey(previousCheckin);

    while (cursor < nextCheckin) {
      if (!repairedDaySet.has(cursor)) repairable.push(cursor);
      cursor = nextDateKey(cursor);
    }
  }

  return repairable.reverse();
}
