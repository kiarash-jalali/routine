export const ROOTINE_TIMEZONE_COOKIE = "rootine-timezone";

export function isTimeZone(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function dateKeyInTimeZone(
  timeZone: string,
  date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
