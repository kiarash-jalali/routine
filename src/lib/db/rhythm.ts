import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseBrowser } from "@/lib/supabaseClient";

export type RhythmSummary = {
  currentDays: number;
  bestDays: number;
  checkedInToday: boolean;
  recentCheckinDays: string[];
  recentRepairedDays: string[];
};

export async function getRhythmSummary(
  today: string,
  windowDays = 7,
  client?: SupabaseClient<Database>,
): Promise<RhythmSummary> {
  const { data, error } = await (client ?? supabaseBrowser())
    .rpc("get_rhythm_summary", {
      p_today: today,
      p_window_days: windowDays,
    })
    .single();

  if (error) throw error;
  if (!data) throw new Error("rhythm_summary_missing");

  return {
    currentDays: data.current_days,
    bestDays: data.best_days,
    checkedInToday: data.checked_in_today,
    recentCheckinDays: data.recent_checkin_days ?? [],
    recentRepairedDays: data.recent_repaired_days ?? [],
  };
}
