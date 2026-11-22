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
export type PlanExercise = {
  id: string;
  plan_id: string;
  user_id: string;
  position: number;
  name: string;
  target_sets: number;
  rep_scheme: string;
  rest_seconds: number | null;
  notes: string | null;
};
export type PlanExerciseInput = {
  id?: string | undefined;
  name: string;
  target_sets: number;
  rep_scheme: string;
  rest_seconds: number | null;
  notes: string | null;
};
export type SetLog = {
  id: string;
  session_id: string;
  exercise_id: string;
  user_id: string;
  set_number: number;
  reps: number;
  weight_kg: number | null;
  band_level: string | null;
  rpe: number | null;
  completed_at: string;
};
export type SetLogInput = Pick<
  SetLog,
  "session_id" | "exercise_id" | "set_number" | "reps" | "weight_kg"
>;
