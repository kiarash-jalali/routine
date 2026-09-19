export type RoutineFrequency = "daily" | "weekly";

export function isRoutineFrequency(value: string): value is RoutineFrequency {
  return value === "daily" || value === "weekly";
}

export type Routine = {
  id: string;
  user_id: string;
  title: string;
  frequency: RoutineFrequency;
  days_of_week: number[] | null; // 1=Mon ... 7=Sun
  preferred_time: string | null; // "HH:mm:ss"
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RoutineFormValues = {
  title: string;
  frequency: RoutineFrequency;
  daysOfWeek: number[];
  preferredTime: string; // "HH:mm"
};
