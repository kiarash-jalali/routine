export type WorkoutInput = {
  name: string;
  activity_type: string;
  duration_minutes: number;
  exercises: string;
  days_of_week: number[];
  preferred_time: string;
  timezone: string;
  is_active: boolean;
  reminders_enabled: boolean;
};
export type WorkoutPlan = WorkoutInput & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};
export type WorkoutSession = {
  id: string;
  user_id: string;
  workout_id: string | null;
  name: string;
  activity_type: string;
  duration_minutes: number;
  exercises: string;
  scheduled_day: string;
  scheduled_time: string;
  scheduled_at: string;
  timezone: string;
  completed_at: string | null;
};
export type SessionInput = Pick<
  WorkoutSession,
  | "name"
  | "activity_type"
  | "duration_minutes"
  | "exercises"
  | "scheduled_day"
  | "scheduled_time"
  | "scheduled_at"
  | "timezone"
>;
