"use client";
import { LifeLinks } from "@/components/life/LifeLinks";
import { useLanguage } from "@/components/preferences/LanguageProvider";

import { Link } from "next-view-transitions";
import { useEffect, useMemo, useRef, useState } from "react";
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
  PageHeader,
  PageShell,
  SectionHeading,
  SegmentedControl,
  Stat,
} from "@/components/ui";
import {
  getDailyProgress,
  setDailyItemCompletion,
} from "@/lib/db/checkins";
import { getRhythmSummary, type RhythmSummary } from "@/lib/db/rhythm";
import { addTask, removeTask } from "@/lib/db/tasks";
import { getErrorMessage } from "@/lib/errors";
import { getMomentCopy, type MomentCopyKey } from "@/lib/moments";
import { consumeFirstRoutineSuccess } from "@/lib/firstRun";
import { checkinItemKey, completionMapFromItems } from "@/lib/checkinProgress";
import {
  filterTasksForToday,
  getLocalDateKey,
  routineOccursOn,
} from "@/lib/today";
import { useToday } from "@/lib/useToday";
import type { CheckinCompletionMap } from "@/types/checkin";
import type { Routine } from "@/types/routine";
import type { Task } from "@/types/task";

function formatDueTime(task: Task, locale: string, anytime: string) {
  if (!task.due_at) return anytime;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(task.due_at));
}

function sortTasks(tasks: Task[]) {
  return tasks.sort((a, b) => {
    if (a.is_done !== b.is_done) return Number(a.is_done) - Number(b.is_done);
    const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    return b.created_at.localeCompare(a.created_at);
  });
}

export function DashboardClient({
  userId,
  initialTasks,
  initialActiveRoutines,
  initialRhythm,
  initialCompletionByItem,
  initialDayKey,
  initialPartialError,
}: {
  userId: string;
  initialTasks: Task[];
  initialActiveRoutines: Routine[];
  initialRhythm: RhythmSummary | null;
  initialCompletionByItem: CheckinCompletionMap;
  initialDayKey: string | null;
  initialPartialError: boolean;
}) {
  const { t, locale, date, time, number, weekday } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [rhythm, setRhythm] = useState<RhythmSummary | null>(initialRhythm);
  const [completionByItem, setCompletionByItem] =
    useState<CheckinCompletionMap>(initialCompletionByItem);
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
  const [firstSuccessRoutine, setFirstSuccessRoutine] = useState<string | null>(
    null,
  );
  const pending = useRef(new Set<string>());
  const [filter, setFilter] = useState<"today" | "all" | "done">("today");
  const today = useToday();
  const todayKey = getLocalDateKey(today);

  useEffect(() => {
    const routineTitle = consumeFirstRoutineSuccess();
    if (routineTitle) setFirstSuccessRoutine(routineTitle);
  }, []);

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
    if (initialPartialError) setError(t("dashboard.partialLoadError"));
  }, [initialPartialError, t]);

  useEffect(() => {
    if (initialDayKey === todayKey && !initialPartialError) return;

    let cancelled = false;
    if (initialDayKey !== todayKey) {
      setRhythm(null);
      setCompletionByItem({});
    }

    async function loadDay() {
      const results = await Promise.allSettled([
        getRhythmSummary(todayKey, 7),
        getDailyProgress(userId, todayKey),
      ]);
      if (cancelled) return;

      const [rhythmResult, progressResult] = results;
      if (rhythmResult.status === "fulfilled") setRhythm(rhythmResult.value);
      if (progressResult.status === "fulfilled") {
        setCompletionByItem(completionMapFromItems(progressResult.value.items));
      }
      if (results.some((result) => result.status === "rejected")) {
        setError(t("dashboard.partialLoadError"));
      }
    }

    void loadDay();
    return () => {
      cancelled = true;
    };
  }, [initialDayKey, initialPartialError, t, todayKey, userId]);

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    if (!userId || !title.trim() || creating) return;
    setCreating(true);
    setFormError(null);
    try {
      const created = await addTask({
        user_id: userId,
        title: title.trim(),
        due_at: dueLocal ? new Date(dueLocal).toISOString() : null,
      });
      setTasks((current) => sortTasks([...current, created]));
      setTitle("");
      setDueLocal("");
      setShowTaskForm(false);
      setFilter("all");
      showMoment("task_added", "add-task", "plus");
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, t("task.addError")));
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
    const pendingKey = checkinItemKey("task", task.id);
    if (pending.current.has(pendingKey)) return;
    const nextCompleted = !task.is_done;

    pending.current.add(pendingKey);
    setPendingIds([...pending.current]);
    setError(null);
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, is_done: nextCompleted } : item,
      ),
    );
    setCompletionByItem((current) => ({
      ...current,
      [pendingKey]: nextCompleted,
    }));

    try {
      await setDailyItemCompletion(
        todayKey,
        "task",
        task.id,
        nextCompleted,
      );
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
      setCompletionByItem((current) => ({
        ...current,
        [pendingKey]: task.is_done,
      }));
      setError(getErrorMessage(error, t("task.updateError")));
    } finally {
      pending.current.delete(pendingKey);
      setPendingIds([...pending.current]);
    }
  }

  async function toggleRoutine(routine: Routine) {
    const pendingKey = checkinItemKey("routine", routine.id);
    if (pending.current.has(pendingKey)) return;
    const previous = Boolean(completionByItem[pendingKey]);
    const nextCompleted = !previous;

    pending.current.add(pendingKey);
    setPendingIds([...pending.current]);
    setError(null);
    setCompletionByItem((current) => ({
      ...current,
      [pendingKey]: nextCompleted,
    }));

    try {
      await setDailyItemCompletion(
        todayKey,
        "routine",
        routine.id,
        nextCompleted,
      );
      if (nextCompleted) {
        showMoment(
          "checkin_routine_completed",
          `routine-${routine.id}`,
          "check",
        );
      }
    } catch (error: unknown) {
      setCompletionByItem((current) => ({
        ...current,
        [pendingKey]: previous,
      }));
      setError(getErrorMessage(error, t("routine.updateError")));
    } finally {
      pending.current.delete(pendingKey);
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
      setFormError(getErrorMessage(error, t("task.deleteError")));
    } finally {
      setDeleting(false);
    }
  }

  const routines = useMemo(
    () => initialActiveRoutines.filter((routine) => routineOccursOn(routine, today)),
    [initialActiveRoutines, today],
  );
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
  const checkedInToday = rhythm?.checkedInToday ?? false;
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - ((today.getDay() + 6) % 7) + index);
    return date;
  });

  return (
    <PageShell>
      <PageHeader
        eyebrow={date(today, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
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
              {t("product.addTask")}
            </Button>
          </MomentSource>
        }
      />
      <LifeLinks />
      <Collapse show={!!firstSuccessRoutine}>
        <Card tone="accent" className="mb-7">
          <div className="flex items-start gap-4">
            <span className="icon-tile shrink-0 bg-surface">
              <Icon name="spark" size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                {t("dashboard.firstSuccessEyebrow")}
              </p>
              <h2 className="display-title mt-1 text-2xl">
                {t("dashboard.firstSuccessTitle", {
                  name: firstSuccessRoutine ?? "",
                })}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {t("dashboard.firstSuccessBody")}
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => setFirstSuccessRoutine(null)}
            >
              {t("common.done")}
            </Button>
          </div>
        </Card>
      </Collapse>
      <Collapse show={!!error}>
        <div className="mb-6">
          <ErrorNotice>{error}</ErrorNotice>
        </div>
      </Collapse>
      <div className="stats-strip mb-7 grid grid-cols-3 divide-x divide-border rounded-2xl px-2 py-5 sm:px-5">
        <div className="px-3 sm:px-5">
          <Stat value={number(routines.length)} label={t("dashboard.routinesTodayCount")} />
        </div>
        <div className="px-3 sm:px-5">
          <Stat value={number(todayTasks.length)} label={t("dashboard.openTasksCount")} />
        </div>
        <div className="px-3 sm:px-5">
          <Stat
            value={rhythm ? number(rhythm.currentDays) : "—"}
            label={
              rhythm?.currentDays === 1
                ? t("dashboard.dayRhythm")
                : t("dashboard.daysRhythm")
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
                  {t("common.manage")}
                  <Icon name="chevron" size={15} />
                </Link>
              }
            />
            <div className="mt-6">
              {routines.length === 0 ? (
                <EmptyState>
                  {t("product.noRoutines")}
                  <br />
                  <Link
                    className="mt-2 inline-flex min-h-11 items-center text-primary"
                    href="/routines"
                  >
                    {t("routine.addSmall")}
                    <Icon name="arrow" size={16} className="ml-2" />
                  </Link>
                </EmptyState>
              ) : (
                <ul>
                  {routines.map((routine) => {
                    const completionKey = checkinItemKey("routine", routine.id);
                    const completed = Boolean(completionByItem[completionKey]);
                    return (
                    <li
                      className={`list-row ${completed ? "is-done" : ""}`}
                      key={routine.id}
                    >
                      <MomentSource id={`routine-${routine.id}`}>
                        <button
                          className="check-control -ml-2"
                          aria-pressed={completed}
                          aria-label={t(
                            completed
                              ? "routine.reopenNamed"
                              : "routine.completeNamed",
                            { name: routine.title },
                          )}
                          disabled={pendingIds.includes(completionKey)}
                          onClick={() => toggleRoutine(routine)}
                        >
                          <CheckCircle checked={completed} />
                        </button>
                      </MomentSource>
                      <div className="min-w-0 flex-1">
                        <p className="row-title">{routine.title}</p>
                        <p className="row-detail">
                          {routine.frequency === "daily"
                            ? t("routine.everyDay")
                            : t("routine.weekly")}
                        </p>
                      </div>
                      <span className="data-text text-xs text-muted">
                        {routine.preferred_time
                          ? time(routine.preferred_time)
                          : t("common.anytime")}
                      </span>
                    </li>
                    );
                  })}
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
                  aria-label={t("product.addTask")}
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
                label={t("task.filter")}
                options={[
                  { value: "today", label: t("common.today") },
                  { value: "all", label: t("common.all") },
                  { value: "done", label: t("task.done") },
                ]}
              />
            </div>
            <AnimatedList>
              {visibleTasks.length === 0 ? (
                <AnimatedListItem key="empty">
                  <EmptyState>
                    {filter === "done"
                      ? t("task.emptyDone")
                      : filter === "all"
                        ? t("task.emptyAll")
                        : t("task.emptyToday")}
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
                        aria-label={t(
                          task.is_done ? "task.reopenNamed" : "task.completeNamed",
                          { name: task.title },
                        )}
                        disabled={pendingIds.includes(checkinItemKey("task", task.id))}
                        onClick={() => toggleDone(task)}
                      >
                        <CheckCircle checked={task.is_done} />
                      </button>
                    </MomentSource>
                    <div className="min-w-0 flex-1">
                      <p className="row-title">{task.title}</p>
                      <p className="row-detail">
                      {formatDueTime(task, locale, t("common.anytime"))}
                    </p>
                    </div>
                    <button
                      className="icon-button danger -mr-2"
                      aria-label={t("task.deleteNamed", { name: task.title })}
                      disabled={pendingIds.includes(checkinItemKey("task", task.id))}
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
              {date(today, { month: "long", year: "numeric" })}
            </p>
            <div className="week-strip mt-4">
              {weekDays.map((date) => {
                const dateKey = getLocalDateKey(date);
                const isToday = dateKey === getLocalDateKey(today);
                const checked = rhythm?.recentCheckinDays.includes(dateKey);
                return (
                  <div
                    key={dateKey}
                    className={`week-day ${isToday ? "is-today" : ""}`}
                    aria-label={`${new Intl.DateTimeFormat(locale, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    }).format(date)}${isToday ? `, ${t("common.today")}` : ""}${checked ? `, ${t("dashboard.checkedIn")}` : ""}`}
                  >
                    <span>
                      {weekday(date.getDay() === 0 ? 7 : date.getDay(), "narrow")}
                    </span>
                    <strong>{new Intl.DateTimeFormat(locale, { day: "numeric" }).format(date)}</strong>
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
              {t("dashboard.viewRhythm")}
              <Icon name="arrow" size={16} />
            </Link>
          </Card>
          <Card tone="accent">
            <span className="icon-tile mb-5 bg-surface">
              <Icon name={checkedInToday ? "checkin" : "moon"} size={22} />
            </span>
            <h2 className="reflection-title">
              {checkedInToday
                ? t("dashboard.showedUp")
                : t("dashboard.moment")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {checkedInToday
                ? t("dashboard.checkinSaved")
                : t("dashboard.reflect")}
            </p>
            <Link href="/checkin" className="btn btn-primary mt-5 w-full">
              {checkedInToday
                ? t("dashboard.viewCheckin")
                : t("dashboard.checkinToday")}
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
            {t("product.task")}
            <Input
              autoFocus
              placeholder={t("product.taskPlaceholder")}
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
              {t("common.cancel")}
            </Button>
            <Button
              className="moment-shine flex-1"
              variant="primary"
              type="submit"
              disabled={creating || !title.trim()}
              busy={creating}
            >
              {creating ? t("common.saving") : t("product.addTask")}
            </Button>
          </div>
        </form>
      </Sheet>
      <Sheet
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("task.deleteTitle")}
        description={
          deleteTarget
            ? t("task.deleteBody", { name: deleteTarget.title })
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
            {t("product.keepTask")}
          </Button>
          <Button
            className="flex-1"
            variant="danger"
            onClick={deleteTask}
            disabled={deleting}
            busy={deleting}
          >
            {t("task.deleteAction")}
          </Button>
        </div>
      </Sheet>
    </PageShell>
  );
}
