import type { Routine, RoutineFormValues } from "@/types/routine";

export const ROUTINE_DAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 7 },
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

