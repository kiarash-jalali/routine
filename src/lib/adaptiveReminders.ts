/** Adaptive reminders (docs/nutrition-roadmap.md S7b). Pure, unit-tested. */

export const REMINDER_CATEGORIES = [
  "task",
  "routine",
  "health",
  "workout",
  "checkin",
  "meal_plan",
  "grocery",
] as const;
export type AdaptiveCategory = (typeof REMINDER_CATEGORIES)[number];

export const QUIET_WINDOW = 5;
export const KEEP_DAYS = 30;
/** Opens could not be reported before the v6 service worker, so older days don't count. */
export const ADAPTIVE_SINCE = "2026-11-25T00:00:00Z";

/** Only these slow down; health, tasks, workouts and weekly reminders never do. */
const THINNED: ReadonlySet<AdaptiveCategory> = new Set<AdaptiveCategory>(["checkin", "routine"]);

export function isAdaptiveCategory(value: string): value is AdaptiveCategory {
  return (REMINDER_CATEGORIES as readonly string[]).includes(value);
}

/** Newest first: was any reminder opened on each of the last days that had one? */
export function isQuiet(openedDays: readonly boolean[]): boolean {
  return (
    openedDays.length >= QUIET_WINDOW &&
    openedDays.slice(0, QUIET_WINDOW).every((opened) => !opened)
  );
}

/** Every other calendar day while a daily category is quiet, otherwise always. */
export function sendsToday(category: AdaptiveCategory, quiet: boolean, day: string): boolean {
  if (!quiet || !THINNED.has(category)) return true;
  return Math.round(Date.parse(`${day}T00:00:00Z`) / 86400000) % 2 === 0;
}

/** Where "Change time" goes; null when that reminder has no time to change. */
export function changeTimeHref(category: AdaptiveCategory): string | null {
  switch (category) {
    case "routine":
      return "/routines";
    case "health":
      return "/health";
    case "workout":
      return "/workouts";
    case "meal_plan":
    case "grocery":
      return "/settings#reminders";
    default:
      return null;
  }
}
