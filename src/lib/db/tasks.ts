import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Task } from "@/types/task";
import { supabaseBrowser } from "@/lib/supabaseClient";

type CreateTaskInput = Pick<Task, "user_id" | "title" | "due_at">;

export async function listTasks(
  client?: SupabaseClient<Database>,
): Promise<Task[]> {
  const supabase = client ?? supabaseBrowser();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("is_done", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addTask(input: CreateTaskInput): Promise<Task> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("tasks")
    .insert(input)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function setTaskDone(
  taskId: string,
  isDone: boolean,
): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase
    .from("tasks")
    .update({ is_done: isDone })
    .eq("id", taskId);

  if (error) throw error;
}

export async function removeTask(taskId: string): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (error) throw error;
}
