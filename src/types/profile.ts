export type Profile = {
  user_id: string;
  display_name: string | null;
  locale: "en" | "fa";
  intro_seen: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};
