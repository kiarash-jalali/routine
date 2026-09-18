export type MedicationPlan = {
  id: string;
  user_id: string;
  name: string;
  dose: string;
  notes: string;
  times: string[];
  days_of_week: number[];
  timezone: string;
  is_active: boolean;
  reminders_enabled: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};
export type MedicationInput = Pick<
  MedicationPlan,
  | "name"
  | "dose"
  | "notes"
  | "times"
  | "days_of_week"
  | "timezone"
  | "is_active"
  | "reminders_enabled"
  | "start_date"
  | "end_date"
>;
export type MedicationReminder = {
  id: string;
  user_id: string;
  medication_id: string;
  scheduled_day: string;
  scheduled_time: string;
  scheduled_at: string;
  timezone: string;
  name: string;
  dose: string;
  taken_at: string | null;
};
