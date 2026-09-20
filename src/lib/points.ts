import { getLocalDateKey, localDateFromKey } from "@/lib/today";

function nextDateKey(dateKey: string): string {
  const date = localDateFromKey(dateKey);
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
    if (!previousCheckin || !nextCheckin) continue;

    let cursor = nextDateKey(previousCheckin);

    while (cursor < nextCheckin) {
      if (!repairedDaySet.has(cursor)) repairable.push(cursor);
      cursor = nextDateKey(cursor);
    }
  }

  return repairable.reverse();
}
