"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Input,
  PageHeader,
  PageShell,
  Pill,
  SectionHeading,
} from "@/components/ui";
import { addTask, listTasks, removeTask, setTaskDone } from "@/lib/db/tasks";
import { listTodaysRoutines } from "@/lib/db/today";
import { getErrorMessage } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { filterTasksForToday } from "@/lib/today";
import type { Routine } from "@/types/routine";
import type { Task } from "@/types/task";

function formatDueTime(task: Task) {
  if (!task.due_at) return "Flexible — no due time";

  return new Date(task.due_at).toLocaleString([], {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const router = useRouter();

  const [loadingUser, setLoadingUser] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [creating, setCreating] = useState(false);

  const [todaysRoutines, setTodaysRoutines] = useState<Routine[]>([]);
  const [loadingRoutines, setLoadingRoutines] = useState(false);
  const [routineError, setRoutineError] = useState<string | null>(null);

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

  async function fetchTodaysRoutines() {
    setRoutineError(null);
    setLoadingRoutines(true);

    try {
      setTodaysRoutines(await listTodaysRoutines());
    } catch (error: unknown) {
      setRoutineError(getErrorMessage(error, "Failed to load routines"));
    } finally {
      setLoadingRoutines(false);
    }
  }

  async function fetchTasks() {
    setTaskError(null);
    setLoadingTasks(true);

    try {
      setTasks(await listTasks());
    } catch (error: unknown) {
      setTaskError(getErrorMessage(error, "Failed to load tasks"));
    } finally {
      setLoadingTasks(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    fetchTasks();
    fetchTodaysRoutines();
  }, [userId]);

  async function logout() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function createTask() {
    if (!userId || !title.trim()) return;

    setCreating(true);
    setTaskError(null);

    try {
      const dueAtIso =
        dueLocal.trim() === "" ? null : new Date(dueLocal).toISOString();

      await addTask({
        user_id: userId,
        title: title.trim(),
        due_at: dueAtIso,
      });

      setTitle("");
      setDueLocal("");
      await fetchTasks();
    } catch (error: unknown) {
      setTaskError(getErrorMessage(error, "Failed to create task"));
    } finally {
      setCreating(false);
    }
  }

  async function toggleDone(task: Task) {
    setTaskError(null);
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, is_done: !item.is_done } : item,
      ),
    );

    try {
      await setTaskDone(task.id, !task.is_done);
    } catch (error: unknown) {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, is_done: task.is_done } : item,
        ),
      );
      setTaskError(getErrorMessage(error, "Failed to update task"));
    }
  }

  async function deleteTask(task: Task) {
    setTaskError(null);
    setTasks((current) => current.filter((item) => item.id !== task.id));

    try {
      await removeTask(task.id);
    } catch (error: unknown) {
      await fetchTasks();
      setTaskError(getErrorMessage(error, "Failed to delete task"));
    }
  }

  const todayTasks = useMemo(() => filterTasksForToday(tasks), [tasks]);
  const completedTaskCount = useMemo(
    () => tasks.filter((task) => task.is_done).length,
    [tasks],
  );
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date()),
    [],
  );

  if (loadingUser) {
    return (
      <PageShell>
        <p className="text-sm text-muted">Loading your day…</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={todayLabel}
        title="Shape today, gently."
        description={
          <>
            Your routines come first. Tasks are here when you need them.
            {email && <span className="ml-1 text-muted-soft">· {email}</span>}
          </>
        }
        actions={
          <>
            <Button variant="primary" onClick={() => router.push("/checkin")}>
              Daily check-in
            </Button>
            <Button onClick={() => router.push("/routines")}>Routines</Button>
            <Button variant="ghost" onClick={logout}>
              Log out
            </Button>
          </>
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <div className="space-y-6">
          <Card>
            <SectionHeading
              title="Today's routines"
              description="The repeating things that give your day some shape."
              action={
                <Button
                  variant="ghost"
                  className="min-h-8 px-2.5 py-1"
                  onClick={fetchTodaysRoutines}
                  disabled={loadingRoutines}
                >
                  {loadingRoutines ? "Refreshing…" : "Refresh"}
                </Button>
              }
            />

            {routineError && (
              <div className="mt-4">
                <ErrorNotice>{routineError}</ErrorNotice>
              </div>
            )}

            {todaysRoutines.length === 0 ? (
              <div className="mt-4">
                <EmptyState>
                  No routines are planned for today. Add one from the Routines
                  page when you are ready.
                </EmptyState>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {todaysRoutines.map((routine) => (
                  <li
                    key={routine.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-soft px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-medium text-foreground">
                        {routine.title}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {routine.preferred_time
                          ? `Preferred at ${routine.preferred_time.slice(0, 5)}`
                          : "No preferred time"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      className="min-h-8 shrink-0 px-2.5 py-1"
                      onClick={() => router.push("/routines")}
                    >
                      Edit
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHeading
              title="Today's tasks"
              description="One-off things that need your attention today."
              action={
                <Button
                  variant="ghost"
                  className="min-h-8 px-2.5 py-1"
                  onClick={fetchTasks}
                  disabled={loadingTasks}
                >
                  {loadingTasks ? "Refreshing…" : "Refresh"}
                </Button>
              }
            />

            {todayTasks.length === 0 ? (
              <div className="mt-4">
                <EmptyState>Nothing urgent is waiting for you today.</EmptyState>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {todayTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-medium text-foreground">
                        {task.title}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {formatDueTime(task)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        className="min-h-8 px-3 py-1"
                        onClick={() => toggleDone(task)}
                      >
                        Done
                      </Button>
                      <Button
                        variant="danger"
                        className="min-h-8 px-3 py-1"
                        onClick={() => deleteTask(task)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionHeading
              title="Add a task"
              description="Keep it lightweight. A due time is optional."
            />
            <div className="mt-4 space-y-3">
              <Input
                placeholder="What needs doing?"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <Input
                type="datetime-local"
                value={dueLocal}
                onChange={(event) => setDueLocal(event.target.value)}
              />
              <Button
                variant="primary"
                className="w-full"
                disabled={creating || !title.trim()}
                onClick={createTask}
              >
                {creating ? "Adding…" : "Add task"}
              </Button>
            </div>
          </Card>

          <Card className="bg-primary-soft/60">
            <p className="text-sm font-semibold text-foreground">Today at a glance</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill>{todaysRoutines.length} routines</Pill>
              <Pill>{todayTasks.length} open tasks</Pill>
              <Pill>{completedTaskCount} completed</Pill>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">
              You do not need a perfect day. The goal is to keep showing up to
              the system.
            </p>
          </Card>
        </div>
      </div>

      {taskError && (
        <div className="mt-6">
          <ErrorNotice>{taskError}</ErrorNotice>
        </div>
      )}

      <Card className="mt-6">
        <SectionHeading
          title="All tasks"
          description="A quieter overview of everything you have captured."
        />

        {tasks.length === 0 ? (
          <div className="mt-4">
            <EmptyState>No tasks yet.</EmptyState>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p
                    className={`break-words font-medium ${
                      task.is_done
                        ? "text-muted-soft line-through"
                        : "text-foreground"
                    }`}
                  >
                    {task.title}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {formatDueTime(task)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    className="min-h-8 px-3 py-1"
                    onClick={() => toggleDone(task)}
                  >
                    {task.is_done ? "Undo" : "Done"}
                  </Button>
                  <Button
                    variant="danger"
                    className="min-h-8 px-3 py-1"
                    onClick={() => deleteTask(task)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
