"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Task } from "@/types/task";
import { addTask, listTasks, removeTask, setTaskDone } from "@/lib/db/tasks";

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

  // 1) Load current user (protected route)
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

  // 2) Fetch tasks (RLS ensures only the current user's rows are returned)
  async function fetchTasks() {
    setTaskError(null);
    setLoadingTasks(true);

    try {
      const { data, error } = await listTasks();
      if (error) throw error;

      setTasks((data ?? []) as Task[]);
    } catch (e: any) {
      setTaskError(e?.message ?? "Failed to load tasks");
    } finally {
      setLoadingTasks(false);
    }
  }

  // Fetch tasks after user is known
  useEffect(() => {
    if (!userId) return;
    fetchTasks();
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
      // Convert datetime-local (local time) into ISO (UTC) for timestamptz.
      const dueAtIso =
        dueLocal.trim() === "" ? null : new Date(dueLocal).toISOString();

      const { error } = await addTask({
        user_id: userId,
        title: title.trim(),
        due_at: dueAtIso,
      });

      if (error) throw error;

      setTitle("");
      setDueLocal("");
      await fetchTasks();
    } catch (e: any) {
      setTaskError(e?.message ?? "Failed to create task");
    } finally {
      setCreating(false);
    }
  }

  async function toggleDone(task: Task) {
    setTaskError(null);

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, is_done: !t.is_done } : t)),
    );

    try {
      const { error } = await setTaskDone(task.id, !task.is_done);
      if (error) throw error;
    } catch (e: any) {
      // Revert optimistic update if it fails
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, is_done: task.is_done } : t,
        ),
      );
      setTaskError(e?.message ?? "Failed to update task");
    }
  }

  async function deleteTask(task: Task) {
    setTaskError(null);

    // Optimistic remove
    setTasks((prev) => prev.filter((t) => t.id !== task.id));

    try {
      const { error } = await removeTask(task.id);
      if (error) throw error;
    } catch (e: any) {
      // Re-fetch to restore truth if delete fails
      await fetchTasks();
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
      if (!t.due_at) return true; // floating tasks show in Today
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
              onClick={() => fetchTasks()}
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
