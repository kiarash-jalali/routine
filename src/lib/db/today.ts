import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { routineOccursOn } from "@/lib/today";
import {
  isRoutineFrequency,
  type Routine,
} from "@/types/routine";

export async function listActiveRoutines(
  client?: SupabaseClient<Database>,
): Promise<Routine[]> {
  const supabase = client ?? supabaseBrowser();
  const { data, error } = await supabase
    .from("routines")
    .select("*")
    .eq("is_active", true)
    .order("preferred_time", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;

  const routines = (data ?? []).map((routine) => {
    if (!isRoutineFrequency(routine.frequency)) {
      throw new Error("invalid_routine_frequency");
    }
    return { ...routine, frequency: routine.frequency };
  });

  return routines;
}

export async function listTodaysRoutines(
  date = new Date(),
  client?: SupabaseClient<Database>,
): Promise<Routine[]> {
  const routines = await listActiveRoutines(client);
  return routines.filter((routine) => routineOccursOn(routine, date));
}
