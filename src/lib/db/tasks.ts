import type { Task } from "@/types/task";
import { supabaseBrowser } from "@/lib/supabaseClient";

type CreateTaskInput = Pick<Task, "user_id" | "title" | "due_at">;

export async function listTasks(): Promise<Task[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("is_done", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function addTask(input: CreateTaskInput): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("tasks").insert(input);

  if (error) throw error;
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


export async function setTaskCompletionStates(
  userId: string,
  states: Array<{ id: string; completed: boolean }>,
): Promise<void> {
  const completedIds = states
    .filter((state) => state.completed)
    .map((state) => state.id);
  const openIds = states
    .filter((state) => !state.completed)
    .map((state) => state.id);

  const db = supabaseBrowser();
  const operations = [];

  if (completedIds.length > 0) {
    operations.push(
      db
        .from("tasks")
        .update({ is_done: true })
        .eq("user_id", userId)
        .in("id", completedIds),
    );
  }
  if (openIds.length > 0) {
    operations.push(
      db
        .from("tasks")
        .update({ is_done: false })
        .eq("user_id", userId)
        .in("id", openIds),
    );
  }

  const results = await Promise.all(operations);
  const failure = results.find((result) => result.error);
  if (failure?.error) throw failure.error;
}
