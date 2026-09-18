import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Profile } from "@/types/profile";

const PROFILE_COLUMNS =
  "user_id,display_name,onboarding_completed,locale,intro_seen,created_at,updated_at";

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function saveDisplayName(
  userId: string,
  displayName: string,
): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) throw error;
}

export async function completeOnboarding(userId: string): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_completed: true,
      intro_seen: true,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) throw error;
}

export async function markIntroSeen(userId: string): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("profiles")
    .update({ intro_seen: true })
    .eq("user_id", userId);
  if (error) throw error;
}
