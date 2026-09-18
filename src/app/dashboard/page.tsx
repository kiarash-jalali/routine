"use client";
import { LifeLinks } from "@/components/life/LifeLinks";
import { useLanguage } from "@/components/preferences/LanguageProvider";

import { Link } from "next-view-transitions";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import {
  MomentPopup,
  MomentSource,
  type MomentNotice,
} from "@/components/MomentPopup";
import { Sheet } from "@/components/Sheet";
import { AnimatedList, AnimatedListItem, Collapse } from "@/components/Motion";
import { TaskScheduleFields } from "@/components/tasks/TaskScheduleFields";
import {
  Button,
  Card,
  CheckCircle,
  EmptyState,
  ErrorNotice,
  Input,
  LoadingState,
  PageHeader,
  PageShell,
  SectionHeading,
  SegmentedControl,
  Stat,
} from "@/components/ui";
import { listCheckinDays } from "@/lib/db/history";
import { listStreakRepairs } from "@/lib/db/points";
import { addTask, listTasks, removeTask, setTaskDone } from "@/lib/db/tasks";
import { listTodaysRoutines } from "@/lib/db/today";
import { getErrorMessage } from "@/lib/errors";
import { getMomentCopy, type MomentCopyKey } from "@/lib/moments";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { calculateStreakMetrics } from "@/lib/streak";
import {
  filterTasksForToday,
  formatFriendlyDate,
  getLocalDateKey,
} from "@/lib/today";
import type { Routine } from "@/types/routine";
import type { Task } from "@/types/task";

function formatDueTime(task: Task) {
  if (!task.due_at) return "Anytime";
  return new Date(task.due_at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [checkinDays, setCheckinDays] = useState<string[] | null>(null);
  const [repairedDays, setRepairedDays] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [creating, setCreating] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [moment, setMoment] = useState<MomentNotice | null>(null);
  const pending = useRef(new Set<string>());
  const [filter, setFilter] = useState<"today" | "all" | "done">("today");
  const [today] = useState(() => new Date());

  function showMoment(
    key: MomentCopyKey,
    sourceId?: string,
    icon: MomentNotice["icon"] = "spark",
  ) {
    const copy = getMomentCopy(key);
    setMoment({
      id: `${key}-${Date.now()}`,
      ...copy,
      sourceId,
      icon,
      tone: "success",
    });
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabaseBrowser().auth.getUser();
        if (error || !data.user) {
          router.replace("/login");
          return;
        }
        if (cancelled) return;
        setUserId(data.user.id);
        const results = await Promise.allSettled([
          listTasks(),
          listTodaysRoutines(),
          listCheckinDays(data.user.id),
          listStreakRepairs(data.user.id),
        ]);
        if (cancelled) return;
        const [taskResult, routineResult, daysResult, repairsResult] = results;
        if (taskResult.status === "fulfilled") setTasks(taskResult.value);
        if (routineResult.status === "fulfilled")
          setRoutines(routineResult.value);
        if (daysResult.status === "fulfilled") setCheckinDays(daysResult.value);
        if (repairsResult.status === "fulfilled")
          setRepairedDays(repairsResult.value.map((repair) => repair.day));
        if (results.some((result) => result.status === "rejected"))
          setError(
            "Some of your day couldn’t be loaded. Refresh to try again.",
          );
      } catch (error: unknown) {
        if (!cancelled)
          setError(getErrorMessage(error, "Your day couldn’t be loaded."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    if (!userId || !title.trim() || creating) return;
    setCreating(true);
    setFormError(null);
    try {
      await addTask({
        user_id: userId,
        title: title.trim(),
        due_at: dueLocal ? new Date(dueLocal).toISOString() : null,
      });
      setTasks(await listTasks());
      setTitle("");
      setDueLocal("");
      setShowTaskForm(false);
      setFilter("all");
      showMoment("task_added", "add-task", "plus");
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, "Your task couldn’t be added."));
    } finally {
      setCreating(false);
    }
  }

  function closeTaskForm() {
    if (creating) return;
    setShowTaskForm(false);
    setTitle("");
    setDueLocal("");
    setFormError(null);
  }

  async function toggleDone(task: Task) {
    if (pending.current.has(task.id)) return;
    pending.current.add(task.id);
    setPendingIds([...pending.current]);
    setError(null);
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, is_done: !task.is_done } : item,
      ),
    );
    try {
      await setTaskDone(task.id, !task.is_done);
      showMoment(
        task.is_done ? "task_reopened" : "task_completed",
        `task-${task.id}`,
        task.is_done ? "history" : "check",
      );
    } catch (error: unknown) {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, is_done: task.is_done } : item,
        ),
      );
      setError(getErrorMessage(error, "Your task couldn’t be updated."));
    } finally {
      pending.current.delete(task.id);
      setPendingIds([...pending.current]);
    }
  }

  async function deleteTask() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setFormError(null);
    try {
      await removeTask(deleteTarget.id);
      setTasks((current) =>
        current.filter((item) => item.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      showMoment("task_deleted", undefined, "trash");
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, "Your task couldn’t be deleted."));
    } finally {
      setDeleting(false);
    }
  }

  const todayTasks = useMemo(
    () => filterTasksForToday(tasks, today),
    [tasks, today],
  );
  const visibleTasks =
    filter === "today"
      ? todayTasks
      : filter === "done"
        ? tasks.filter((task) => task.is_done)
        : tasks;
  const streak = calculateStreakMetrics([
    ...(checkinDays ?? []),
    ...repairedDays,
  ]);
  const checkedInToday = checkinDays?.includes(getLocalDateKey(today));
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - ((today.getDay() + 6) % 7) + index);
    return date;
  });

  if (loading)
    return (
      <PageShell>
        <LoadingState label={t("common.loading")} />
      </PageShell>
    );

  return (
    <PageShell>
      <PageHeader
        eyebrow={formatFriendlyDate(today)}
        title={t("nav.today")}
        description={t("product.todayBody")}
        actions={
          <MomentSource id="add-task">
            <Button
              className="moment-shine"
              variant="primary"
              onClick={() => {
                setFormError(null);
                setShowTaskForm(true);
              }}
            >
              <Icon name="plus" size={18} />
      <LifeLinks />
              Add task
            </Button>
          </MomentSource>
        }
      />
      <Collapse show={!!error}>
        <div className="mb-6">
          <ErrorNotice>{error}</ErrorNotice>
        </div>
      </Collapse>
      <div className="stats-strip mb-7 grid grid-cols-3 divide-x divide-border rounded-2xl px-2 py-5 sm:px-5">
        <div className="px-3 sm:px-5">
          <Stat value={routines.length} label="routines today" />
        </div>
        <div className="px-3 sm:px-5">
          <Stat value={todayTasks.length} label="open tasks" />
        </div>
        <div className="px-3 sm:px-5">
          <Stat
            value={checkinDays ? streak.currentDays : "—"}
            label={
              streak.currentDays === 1 ? "day in rhythm" : "days in rhythm"
            }
          />
        </div>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <Card>
            <SectionHeading
              title={t("product.routinesToday")}
              action={
                <Link
                  className="inline-flex min-h-8 items-center gap-1 text-sm text-primary"
                  href="/routines"
                >
                  Manage
                  <Icon name="chevron" size={15} />
                </Link>
              }
            />
            <div className="mt-6">
              {routines.length === 0 ? (
                <EmptyState>
                  No routines planned for today.
                  <br />
                  <Link
                    className="mt-2 inline-flex min-h-11 items-center text-primary"
                    href="/routines"
                  >
                    Add a small routine
                    <Icon name="arrow" size={16} className="ml-2" />
                  </Link>
                </EmptyState>
              ) : (
                <ul>
                  {routines.map((routine) => (
                    <li className="list-row" key={routine.id}>
                      <span
                        className={`icon-tile ${routine.preferred_time && routine.preferred_time < "12:00" ? "amber" : ""}`}
                      >
                        <Icon
                          name={
                            routine.preferred_time &&
                            routine.preferred_time >= "17:00"
                              ? "moon"
                              : "sun"
                          }
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="row-title">{routine.title}</p>
                        <p className="row-detail">
                          {routine.frequency === "daily"
                            ? "Every day"
                            : "Weekly"}
                        </p>
                      </div>
                      <span className="data-text text-xs text-muted">
                        {routine.preferred_time?.slice(0, 5) || "Anytime"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
          <Card>
            <SectionHeading
              title={t("product.tasks")}
              action={
                <button
                  className="icon-button -mr-2 -mt-2"
                  aria-label="Add a task"
                  onClick={() => {
                    setFormError(null);
                    setShowTaskForm(true);
                  }}
                >
                  <Icon name="plus" />
                </button>
              }
            />
            <div className="mt-4 mb-6">
              <SegmentedControl
                value={filter}
                onChange={setFilter}
                label="Task filter"
                options={[
                  { value: "today", label: "Today" },
                  { value: "all", label: "All" },
                  { value: "done", label: "Done" },
                ]}
              />
            </div>
            <AnimatedList>
              {visibleTasks.length === 0 ? (
                <AnimatedListItem key="empty">
                  <EmptyState>
                    {filter === "done"
                      ? "Your completed tasks will be here."
                      : filter === "all"
                        ? "Nothing here yet. Add a task when you need one."
                        : "A little breathing room. No open tasks for today."}
                  </EmptyState>
                </AnimatedListItem>
              ) : (
                visibleTasks.map((task) => (
                  <AnimatedListItem
                    key={task.id}
                    className={`list-row ${task.is_done ? "is-done" : ""}`}
                  >
                    <MomentSource id={`task-${task.id}`}>
                      <button
                        className="check-control -ml-2"
                        aria-pressed={task.is_done}
                        aria-label={`${task.is_done ? "Reopen" : "Complete"} ${task.title}`}
                        disabled={pendingIds.includes(task.id)}
                        onClick={() => toggleDone(task)}
                      >
                        <CheckCircle checked={task.is_done} />
                      </button>
                    </MomentSource>
                    <div className="min-w-0 flex-1">
                      <p className="row-title">{task.title}</p>
                      <p className="row-detail">{formatDueTime(task)}</p>
                    </div>
                    <button
                      className="icon-button danger -mr-2"
                      aria-label={`Delete ${task.title}`}
                      disabled={pendingIds.includes(task.id)}
                      onClick={() => {
                        setFormError(null);
                        setDeleteTarget(task);
                      }}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </AnimatedListItem>
                ))
              )}
            </AnimatedList>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <SectionHeading title={t("product.week")} />
            <p className="mt-1 text-sm text-muted">
              {today.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </p>
            <div className="week-strip mt-4">
              {weekDays.map((date) => {
                const dateKey = getLocalDateKey(date);
                const isToday = dateKey === getLocalDateKey(today);
                const checked = checkinDays?.includes(dateKey);
                return (
                  <div
                    key={dateKey}
                    className={`week-day ${isToday ? "is-today" : ""}`}
                    aria-label={`${formatFriendlyDate(date)}${isToday ? ", today" : ""}${checked ? ", checked in" : ""}`}
                  >
                    <span>
                      {date.toLocaleDateString(undefined, {
                        weekday: "narrow",
                      })}
                    </span>
                    <strong>{date.getDate()}</strong>
                    <span
                      className={`week-dot ${checked ? "filled" : ""}`}
                      aria-hidden="true"
                    />
                  </div>
                );
              })}
            </div>
            <Link
              href="/history"
              className="mt-4 flex min-h-11 items-center justify-between border-t border-border pt-4 text-sm text-muted"
            >
              View your rhythm
              <Icon name="arrow" size={16} />
            </Link>
          </Card>
          <Card tone="accent">
            <span className="icon-tile mb-5 bg-surface">
              <Icon name={checkedInToday ? "checkin" : "moon"} size={22} />
            </span>
            <h2 className="reflection-title">
              {checkedInToday
                ? "You showed up today."
                : "A moment for yourself."}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {checkedInToday
                ? "Your check-in is saved. You can still make changes."
                : "Take a breath and reflect on what happened today."}
            </p>
            <Link href="/checkin" className="btn btn-primary mt-5 w-full">
              {checkedInToday ? "View check-in" : "Check in today"}
              <Icon name="arrow" size={17} />
            </Link>
          </Card>
        </div>
      </div>

      <MomentPopup notice={moment} onDismiss={() => setMoment(null)} />

      <Sheet
        open={showTaskForm}
        onClose={closeTaskForm}
        busy={creating}
        title={t("product.newTask")}
        description={t("product.newTaskBody")}
      >
        <form onSubmit={createTask} className="mt-6 space-y-5">
          <label className="grid gap-2 text-sm font-medium">
            Task
            <Input
              autoFocus
              placeholder="What’s on your mind?"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              disabled={creating}
            />
          </label>
          <TaskScheduleFields
            value={dueLocal}
            onChange={setDueLocal}
            disabled={creating}
          />
          <Collapse show={!!formError}>
            <ErrorNotice>{formError}</ErrorNotice>
          </Collapse>
          <div className="flex gap-3">
            <Button onClick={closeTaskForm} disabled={creating}>
              Cancel
            </Button>
            <Button
              className="moment-shine flex-1"
              variant="primary"
              type="submit"
              disabled={creating || !title.trim()}
              busy={creating}
            >
              {creating ? "Adding…" : "Add task"}
            </Button>
          </div>
        </form>
      </Sheet>
      <Sheet
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this task?"
        description={
          deleteTarget
            ? `“${deleteTarget.title}” will be removed from your tasks.`
            : undefined
        }
        busy={deleting}
        keyboardAssist={false}
        compact
      >
        {formError && (
          <div className="mt-4">
            <ErrorNotice>{formError}</ErrorNotice>
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <Button
            className="flex-1"
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
          >
            Keep task
          </Button>
          <Button
            className="flex-1"
            variant="danger"
            onClick={deleteTask}
            disabled={deleting}
            busy={deleting}
          >
            Delete task
          </Button>
        </div>
      </Sheet>
    </PageShell>
  );
}
