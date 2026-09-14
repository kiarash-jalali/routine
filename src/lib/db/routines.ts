import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Routine } from "@/types/routine";

type CreateRoutineInput = Pick<
  Routine,
  "user_id" | "title" | "frequency" | "days_of_week" | "preferred_time"
>;

export async function listRoutines(): Promise<Routine[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("routines")
    .select("*")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Routine[];
}

export async function addRoutine(input: CreateRoutineInput): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("routines").insert(input);

  if (error) throw error;
}

export async function toggleRoutineActive(
  routineId: string,
  isActive: boolean,
): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase
    .from("routines")
    .update({ is_active: isActive })
    .eq("id", routineId);

  if (error) throw error;
}

export async function removeRoutine(routineId: string): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase
    .from("routines")
    .delete()
    .eq("id", routineId);

  if (error) throw error;
}
