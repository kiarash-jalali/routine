export function getDeviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function localClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    day: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function clockMinutes(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

export function isLocalTimeDue(
  currentTime: string,
  scheduledTime: string,
  windowMinutes = 15,
) {
  const delta = clockMinutes(currentTime) - clockMinutes(scheduledTime);
  return delta >= 0 && delta < windowMinutes;
}

export function fiveMinuteBucket(now: Date) {
  return new Date(Math.floor(now.getTime() / 300000) * 300000).toISOString();
}

export function previousDateKey(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function isoWeekday(day: string) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function routineOccursOnDay(
  frequency: "daily" | "weekly",
  daysOfWeek: number[] | null,
  day: string,
) {
  return (
    frequency === "daily" ||
    (frequency === "weekly" && Boolean(daysOfWeek?.includes(isoWeekday(day))))
  );
}

export function reminderState(
  scheduledAt: string,
  completedAt: string | null,
  now: Date,
) {
  return completedAt
    ? "taken"
    : new Date(scheduledAt) <= now
      ? "missed"
      : "upcoming";
}
