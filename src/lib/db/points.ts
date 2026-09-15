import { supabaseBrowser } from "@/lib/supabaseClient";
import type { StreakRepair } from "@/types/points";

export async function getPointBalance(): Promise<number> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.rpc("get_point_balance");

  if (error) throw error;
  return Number(data ?? 0);
}

export async function listStreakRepairs(
  userId: string,
): Promise<StreakRepair[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("streak_repairs")
    .select("day,cost_points,created_at")
    .eq("user_id", userId)
    .order("day", { ascending: true });

  if (error) throw error;
  return (data ?? []) as StreakRepair[];
}

export async function repairStreakDay(day: string): Promise<number> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.rpc("repair_streak_day", {
    target_day: day,
  });

  if (error) throw error;
  return Number(data ?? 0);
}
