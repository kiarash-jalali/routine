import { supabaseBrowser } from "@/lib/supabaseClient";
import {
  isRoutineFrequency,
  type Routine,
} from "@/types/routine";

type RoutineWriteFields = Pick<
  Routine,
  "title" | "frequency" | "days_of_week" | "preferred_time"
>;

type CreateRoutineInput = RoutineWriteFields & Pick<Routine, "user_id">;
type UpdateRoutineInput = RoutineWriteFields;

export async function listRoutines(): Promise<Routine[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("routines")
    .select("*")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((routine) => {
    if (!isRoutineFrequency(routine.frequency)) {
      throw new Error("invalid_routine_frequency");
    }
    return { ...routine, frequency: routine.frequency };
  });
}

export async function addRoutine(input: CreateRoutineInput): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("routines").insert(input);

  if (error) throw error;
}

export async function updateRoutine(
  routineId: string,
  input: UpdateRoutineInput,
): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase
    .from("routines")
    .update(input)
    .eq("id", routineId);

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
