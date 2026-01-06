"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";

type Task = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  due_at: string | null; // ISO string from Supabase
  is_done: boolean;
  created_at: string;
  updated_at: string;
};

function toLocalDatetimeValue(date: Date) {
  // YYYY-MM-DDTHH:mm for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function DashboardPage() {
  const router = useRouter();

  const [loadingUser, setLoadingUser] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  // Create task form state
  const [title, setTitle] = useState("");
  const [dueLocal, setDueLocal] = useState<string>(""); // datetime-local string
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const supabase = supabaseBrowser();
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;

        if (!data.user) {
          router.replace("/login");
          return;
        }

        if (mounted) {
          setEmail(data.user.email ?? null);
          setUserId(data.user.id);
          setLoadingUser(false);
        }
      } catch {
        router.replace("/login");
      }
    }

    loadUser();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function fetchTasks(uid: string) {
    setTaskError(null);
    setLoadingTasks(true);
    try {
      const supabase = supabaseBrowser();

      // Fetch your tasks (RLS ensures only your rows come back)
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("is_done", { ascending: true })
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks((data ?? []) as Task[]);
    } catch (e: any) {
      setTaskError(e?.message ?? "Failed to load tasks");
    } finally {
      setLoadingTasks(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    fetchTasks(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function logout() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function createTask() {
    if (!userId) return;
    if (!title.trim()) return;

    setCreating(true);
    setTaskError(null);

    try {
      const supabase = supabaseBrowser();

      // Convert datetime-local (local time) into a real Date → ISO string.
      // Supabase timestamptz expects an ISO timestamp.
      const dueAtIso =
        dueLocal.trim() === "" ? null : new Date(dueLocal).toISOString();

      const { error } = await supabase.from("tasks").insert({
        user_id: userId,
        title: title.trim(),
        due_at: dueAtIso,
      });

      if (error) throw error;

      setTitle("");
      setDueLocal("");
      await fetchTasks(userId);
    } catch (e: any) {
      setTaskError(e?.message ?? "Failed to create task");
    } finally {
      setCreating(false);
    }
  }

  async function toggleDone(task: Task) {
    if (!userId) return;

    setTaskError(null);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase
        .from("tasks")
        .update({ is_done: !task.is_done })
        .eq("id", task.id);

      if (error) throw error;

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, is_done: !t.is_done } : t))
      );
    } catch (e: any) {
      setTaskError(e?.message ?? "Failed to update task");
    }
  }

  async function deleteTask(task: Task) {
    if (!userId) return;

    setTaskError(null);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;

      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (e: any) {
      setTaskError(e?.message ?? "Failed to delete task");
    }
  }

  const todayTasks = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return tasks.filter((t) => {
      if (t.is_done) return false;
      if (!t.due_at) return true; // no due date → show in Today as “floating”
      const due = new Date(t.due_at);
      return due >= start && due <= end;
    });
  }, [tasks]);

  if (loadingUser) return <main className="p-6">Loading...</main>;

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600">Logged in as: {email}</p>
          </div>
          <button onClick={logout} className="rounded-xl border px-3 py-2">
            Log out
          </button>
        </div>

        {/* Create task */}
        <section className="mt-6 rounded-2xl border p-4">
          <h2 className="font-semibold">Add a task</h2>
          <div className="mt-3 grid gap-3">
            <input
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Task title (e.g., Bank, meeting, gym)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                className="w-full rounded-xl border px-3 py-2"
                type="datetime-local"
                value={dueLocal}
                onChange={(e) => setDueLocal(e.target.value)}
              />
              <button
                className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-60"
                disabled={creating || !title.trim()}
                onClick={createTask}
                type="button"
              >
                {creating ? "Adding..." : "Add"}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Tip: Leave the date/time empty to keep it as a “floating” task for
              Today.
            </p>
          </div>
        </section>

        {/* Errors */}
        {taskError && <p className="mt-4 text-sm text-red-600">{taskError}</p>}

        {/* Today */}
        <section className="mt-6 rounded-2xl border p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Today</h2>
            <button
              className="text-sm underline"
              onClick={() => userId && fetchTasks(userId)}
              type="button"
              disabled={loadingTasks}
            >
              {loadingTasks ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {todayTasks.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">No tasks for Today 🎉</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {todayTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-3 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium break-words">{t.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t.due_at
                        ? `Due: ${new Date(t.due_at).toLocaleString()}`
                        : "No due time"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
                      onClick={() => toggleDone(t)}
                      type="button"
                    >
                      Done
                    </button>
                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
                      onClick={() => deleteTask(t)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* All tasks (including done) */}
        <section className="mt-6 rounded-2xl border p-4">
          <h2 className="font-semibold">All tasks</h2>

          {tasks.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">
              No tasks yet. Add your first one above.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-3 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <p
                      className={`font-medium break-words ${
                        t.is_done ? "line-through text-gray-500" : ""
                      }`}
                    >
                      {t.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t.due_at
                        ? `Due: ${new Date(t.due_at).toLocaleString()}`
                        : "No due time"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
                      onClick={() => toggleDone(t)}
                      type="button"
                    >
                      {t.is_done ? "Undo" : "Done"}
                    </button>
                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
                      onClick={() => deleteTask(t)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
