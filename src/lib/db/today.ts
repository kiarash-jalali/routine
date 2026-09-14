import { supabaseBrowser } from "@/lib/supabaseClient";
import { routineOccursOn } from "@/lib/today";
import type { Routine } from "@/types/routine";

export async function listTodaysRoutines(date = new Date()): Promise<Routine[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("routines")
    .select("*")
    .eq("is_active", true)
    .order("preferred_time", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as Routine[]).filter((routine) =>
    routineOccursOn(routine, date),
  );
}
