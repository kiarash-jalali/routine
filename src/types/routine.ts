export type Routine = {
  id: string;
  user_id: string;
  title: string;
  frequency: "daily" | "weekly";
  days_of_week: number[] | null; // 1=Mon ... 7=Sun
  preferred_time: string | null; // "HH:mm:ss"
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
