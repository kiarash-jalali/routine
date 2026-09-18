import { supabaseBrowser } from "@/lib/supabaseClient";

type RhythmSummaryRow = {
  current_days: number;
  best_days: number;
  checked_in_today: boolean;
  recent_checkin_days: string[] | null;
  recent_repaired_days: string[] | null;
};

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
): Promise<RhythmSummary> {
  const { data, error } = await supabaseBrowser()
    .rpc("get_rhythm_summary", {
      p_today: today,
      p_window_days: windowDays,
    })
    .single();

  if (error) throw error;
  const row = data as RhythmSummaryRow;

  return {
    currentDays: row.current_days,
    bestDays: row.best_days,
    checkedInToday: row.checked_in_today,
    recentCheckinDays: row.recent_checkin_days ?? [],
    recentRepairedDays: row.recent_repaired_days ?? [],
  };
}
