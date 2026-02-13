import type { Task } from "@/types/task";
import { supabaseBrowser } from "@/lib/supabaseClient";

export async function listTasks() {
  const supabase = supabaseBrowser();
  return await supabase
    .from("tasks")
    .select("*")
    .order("is_done", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
}

export async function addTask(input: {
  user_id: string;
  title: string;
  due_at: string | null;
}) {
  const supabase = supabaseBrowser();
  return await supabase.from("tasks").insert(input);
}

export async function setTaskDone(taskId: string, isDone: boolean) {
  const supabase = supabaseBrowser();
  return await supabase.from("tasks").update({ is_done: isDone }).eq("id", taskId);
}

export async function removeTask(taskId: string) {
  const supabase = supabaseBrowser();
  return await supabase.from("tasks").delete().eq("id", taskId);
}
