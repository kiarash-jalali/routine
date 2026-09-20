import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { PointRules, StreakRepair } from "@/types/points";

export async function getPointBalance(
  client?: SupabaseClient<Database>,
): Promise<number> {
  const supabase = client ?? supabaseBrowser();
  const { data, error } = await supabase.rpc("get_point_balance");

  if (error) throw error;
  return Number(data ?? 0);
}

export async function getPointRules(
  client?: SupabaseClient<Database>,
): Promise<PointRules> {
  const supabase = client ?? supabaseBrowser();
  const { data, error } = await supabase.rpc("get_point_rules").single();

  if (error) throw error;
  if (!data) throw new Error("point_rules_unavailable");
  return data;
}

export async function listStreakRepairs(
  userId: string,
  client?: SupabaseClient<Database>,
): Promise<StreakRepair[]> {
  const supabase = client ?? supabaseBrowser();
  const { data, error } = await supabase
    .from("streak_repairs")
    .select("day,cost_points,created_at")
    .eq("user_id", userId)
    .order("day", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function repairStreakDay(day: string): Promise<number> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.rpc("repair_streak_day", {
    target_day: day,
  });

  if (error) throw error;
  return Number(data ?? 0);
}
