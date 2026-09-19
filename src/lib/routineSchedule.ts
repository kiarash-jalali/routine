import type { Routine, RoutineFormValues } from "@/types/routine";

export const ROUTINE_DAYS = [
  { value: 1 },
  { value: 2 },
  { value: 3 },
  { value: 4 },
  { value: 5 },
  { value: 6 },
  { value: 7 },
] as const;

export function getDefaultRoutineFormValues(): RoutineFormValues {
  return {
    title: "",
    frequency: "daily",
    daysOfWeek: [1, 2, 3, 4, 5],
    preferredTime: "09:00",
  };
}

export function routineToFormValues(routine: Routine): RoutineFormValues {
  return {
    title: routine.title,
    frequency: routine.frequency,
    daysOfWeek: routine.days_of_week ?? [1, 2, 3, 4, 5],
    preferredTime: routine.preferred_time?.slice(0, 5) ?? "09:00",
  };
}

export function formatPreferredTimeForDatabase(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}
