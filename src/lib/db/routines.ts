import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Routine } from "@/types/routine";

export async function listRoutines() {
  const supabase = supabaseBrowser();
  return await supabase
    .from("routines")
    .select("*")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });
}

export async function addRoutine(input: {
  user_id: string;
  title: string;
  frequency: "daily" | "weekly";
  days_of_week: number[] | null;
  preferred_time: string | null;
}) {
  const supabase = supabaseBrowser();
  return await supabase.from("routines").insert(input);
}

export async function toggleRoutineActive(
  routineId: string,
  isActive: boolean,
) {
  const supabase = supabaseBrowser();
  return await supabase
    .from("routines")
    .update({ is_active: isActive })
    .eq("id", routineId);
}

export async function removeRoutine(routineId: string) {
  const supabase = supabaseBrowser();
  return await supabase.from("routines").delete().eq("id", routineId);
}
