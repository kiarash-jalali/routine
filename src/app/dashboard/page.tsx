"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Input,
  PageHeader,
  PageShell,
  SectionHeading,
  Stat,
} from "@/components/ui";
import { addTask, listTasks, removeTask, setTaskDone } from "@/lib/db/tasks";
import { listTodaysRoutines } from "@/lib/db/today";
import { getErrorMessage } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { filterTasksForToday, formatFriendlyDate } from "@/lib/today";
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
  const [userId, setUserId] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [taskError, setTaskError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [creating, setCreating] = useState(false);

  const [todaysRoutines, setTodaysRoutines] = useState<Routine[]>([]);
  const [loadingRoutines, setLoadingRoutines] = useState(true);
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
  const todayLabel = useMemo(() => formatFriendlyDate(), []);

  if (loadingUser) {
    return (
      <PageShell>
        <p className="text-sm text-muted">Loading your day…</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AppNav />

      <PageHeader
        eyebrow={todayLabel}
        title="Shape today, gently."
        description="Your routines come first. Tasks are here when you need them."
        actions={
          <Button variant="primary" onClick={() => router.push("/checkin")}>
            Check in today
          </Button>
        }
      />

      <div className="mt-5 inline-grid w-full max-w-2xl grid-cols-3 divide-x divide-primary/10 rounded-2xl border border-primary/15 bg-primary-soft/40 px-2 py-3 shadow-sm sm:px-3">
        <div className="px-2 sm:px-4">
          <Stat value={todaysRoutines.length} label="routines today" />
        </div>
        <div className="px-3 sm:px-5">
          <Stat value={todayTasks.length} label="open tasks today" />
        </div>
        <div className="px-3 sm:px-5">
          <Stat value={completedTaskCount} label="completed tasks" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.7fr)] lg:items-start">
        <div className="space-y-6">
          <Card>
            <SectionHeading
              title="Today's routines"
              description="The repeating things that give your day some shape."
            />

            {routineError && (
              <div className="mt-4">
                <ErrorNotice>{routineError}</ErrorNotice>
              </div>
            )}

            {loadingRoutines ? (
              <p className="mt-4 text-sm text-muted">Loading routines…</p>
            ) : todaysRoutines.length === 0 ? (
              <div className="mt-4">
                <EmptyState>
                  No routines are planned for today. Add one from the Routines
                  page when you are ready.
                </EmptyState>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {todaysRoutines.map((routine) => (
                  <li
                    key={routine.id}
                    className="flex items-center justify-between gap-4 py-3.5 first:pt-1 last:pb-0"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="wrap-break-word font-medium text-foreground">
                          {routine.title}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {routine.preferred_time
                            ? `Preferred at ${routine.preferred_time.slice(0, 5)}`
                            : "No preferred time"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      className="min-h-8 shrink-0 px-2.5 py-1"
                      onClick={() => router.push("/routines")}
                    >
                      Manage
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
            />

            {loadingTasks ? (
              <p className="mt-4 text-sm text-muted">Loading tasks…</p>
            ) : todayTasks.length === 0 ? (
              <div className="mt-4">
                <EmptyState>Nothing urgent is waiting for you today.</EmptyState>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {todayTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-col gap-3 py-3.5 first:pt-1 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="wrap-break-word font-medium text-foreground">
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

        <Card tone="soft" className="self-start lg:sticky lg:top-8">
          <SectionHeading
            title="Quick task"
            description="Capture one-off work without turning it into a routine."
          />
          <div className="mt-5 space-y-3">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted">Task</span>
              <Input
                placeholder="What needs doing?"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted">Due time</span>
              <Input
                type="datetime-local"
                value={dueLocal}
                onChange={(event) => setDueLocal(event.target.value)}
              />
            </label>
            <Button
              className="w-full"
              disabled={creating || !title.trim()}
              onClick={createTask}
            >
              {creating ? "Adding…" : "Add task"}
            </Button>
          </div>
        </Card>
      </div>

      {taskError && (
        <div className="mt-6">
          <ErrorNotice>{taskError}</ErrorNotice>
        </div>
      )}

      <Card className="mt-6">
        <SectionHeading
          title="All tasks"
          description="Everything you have captured, including completed tasks."
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
                className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        task.is_done ? "bg-border-strong" : "bg-primary"
                      }`}
                      aria-hidden="true"
                    />
                    <p
                      className={`wrap-break-word font-medium ${
                        task.is_done
                          ? "text-muted-soft line-through"
                          : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </p>
                  </div>
                  <p className="mt-1 pl-4 text-xs text-muted">
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
