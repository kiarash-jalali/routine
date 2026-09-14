"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  PageShell,
  ProgressBar,
  SectionHeading,
} from "@/components/ui";
import {
  findDailyCheckin,
  getOrCreateDailyCheckin,
  listCheckinItems,
  saveCheckinItems,
} from "@/lib/db/checkins";
import { listTasks } from "@/lib/db/tasks";
import { listTodaysRoutines } from "@/lib/db/today";
import { getErrorMessage } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabaseClient";
import {
  filterTasksForToday,
  formatFriendlyDate,
  getLocalDateKey,
} from "@/lib/today";
import type {
  CheckinCompletionMap,
  CheckinItem,
  CheckinItemType,
  CheckinItemUpsert,
} from "@/types/checkin";
import type { Routine } from "@/types/routine";
import type { Task } from "@/types/task";

type CheckinChoiceProps = {
  title: string;
  detail?: string;
  completed: boolean;
  locked: boolean;
  onToggle: () => void;
};

function CheckinChoice({
  title,
  detail,
  completed,
  locked,
  onToggle,
}: CheckinChoiceProps) {
  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-ring disabled:cursor-default ${
        completed
          ? "border-primary bg-primary-soft"
          : "border-border bg-surface-soft hover:border-border-strong hover:bg-surface"
      }`}
      aria-pressed={completed}
      disabled={locked}
      onClick={onToggle}
    >
      <span className="min-w-0">
        <span className="block wrap-break-word font-medium text-foreground">
          {title}
        </span>
        {detail && (
          <span className="mt-1 block text-xs text-muted">{detail}</span>
        )}
      </span>

      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition ${
          completed
            ? "border-primary bg-primary text-white"
            : "border-border-strong bg-surface text-transparent"
        }`}
        aria-hidden="true"
      >
        ✓
      </span>
    </button>
  );
}

function createItemKey(itemType: CheckinItemType, itemId: string): string {
  return `${itemType}:${itemId}`;
}

function createCompletionMap(items: CheckinItem[]): CheckinCompletionMap {
  return Object.fromEntries(
    items.map((item) => [
      createItemKey(item.item_type, item.item_id),
      item.completed,
    ]),
  );
}

function formatRoutineTime(routine: Routine): string | undefined {
  if (!routine.preferred_time) return undefined;
  return `Preferred at ${routine.preferred_time.slice(0, 5)}`;
}

function formatTaskTime(task: Task): string {
  if (!task.due_at) return "Flexible — no set time";

  return `Due at ${new Date(task.due_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function CheckinPage() {
  const router = useRouter();
  const [today] = useState(() => getLocalDateKey());
  const [todayLabel] = useState(() => formatFriendlyDate());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [dailyCheckinId, setDailyCheckinId] = useState<string | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completionByItem, setCompletionByItem] =
    useState<CheckinCompletionMap>({});
  const [savedCompletionByItem, setSavedCompletionByItem] =
    useState<CheckinCompletionMap>({});
  const [hasFinishedToday, setHasFinishedToday] = useState(false);
  const [editingFinishedCheckin, setEditingFinishedCheckin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCheckin() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const supabase = supabaseBrowser();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) {
          router.replace("/login");
          return;
        }

        const [todaysRoutines, allTasks, existingCheckin] = await Promise.all([
          listTodaysRoutines(),
          listTasks(),
          findDailyCheckin(user.id, today),
        ]);

        const existingItems = existingCheckin
          ? await listCheckinItems(existingCheckin.id)
          : [];
        const existingCompletionMap = createCompletionMap(existingItems);

        if (cancelled) return;

        setUserId(user.id);
        setDailyCheckinId(existingCheckin?.id ?? null);
        setRoutines(todaysRoutines);
        setTasks(filterTasksForToday(allTasks));
        setCompletionByItem(existingCompletionMap);
        setSavedCompletionByItem(existingCompletionMap);
        setHasFinishedToday(Boolean(existingCheckin));
        setEditingFinishedCheckin(false);
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(
            getErrorMessage(error, "Today's check-in could not be loaded."),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCheckin();

    return () => {
      cancelled = true;
    };
  }, [router, today]);

  function toggleItem(itemType: CheckinItemType, itemId: string) {
    const itemKey = createItemKey(itemType, itemId);
    setCompletionByItem((current) => ({
      ...current,
      [itemKey]: !current[itemKey],
    }));
  }

  function isItemCompleted(itemType: CheckinItemType, itemId: string) {
    return Boolean(completionByItem[createItemKey(itemType, itemId)]);
  }

  function cancelFinishedCheckinEdit() {
    setCompletionByItem(savedCompletionByItem);
    setEditingFinishedCheckin(false);
    setErrorMessage(null);
  }

  async function finishDay() {
    if (!userId) return;

    setSaving(true);
    setErrorMessage(null);

    try {
      const checkinId =
        dailyCheckinId ?? (await getOrCreateDailyCheckin(userId, today)).id;

      const routineItems: CheckinItemUpsert[] = routines.map((routine) => ({
        user_id: userId,
        checkin_id: checkinId,
        item_type: "routine",
        item_id: routine.id,
        completed: isItemCompleted("routine", routine.id),
      }));

      const taskItems: CheckinItemUpsert[] = tasks.map((task) => ({
        user_id: userId,
        checkin_id: checkinId,
        item_type: "task",
        item_id: task.id,
        completed: isItemCompleted("task", task.id),
      }));

      await saveCheckinItems([...routineItems, ...taskItems]);
      setDailyCheckinId(checkinId);
      setSavedCompletionByItem({ ...completionByItem });
      setHasFinishedToday(true);
      setEditingFinishedCheckin(false);
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(error, "Today's check-in could not be saved."),
      );
    } finally {
      setSaving(false);
    }
  }

  const completedCount = [
    ...routines.map((routine) => isItemCompleted("routine", routine.id)),
    ...tasks.map((task) => isItemCompleted("task", task.id)),
  ].filter(Boolean).length;
  const totalCount = routines.length + tasks.length;
  const completionPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const checkinLocked =
    saving || (hasFinishedToday && !editingFinishedCheckin);

  if (loading) {
    return (
      <PageShell className="max-w-4xl">
        <p className="text-sm text-muted">Loading today&apos;s check-in…</p>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-4xl">
      <AppNav />

      <PageHeader
        eyebrow={todayLabel}
        title="Daily check-in"
        description="Notice what you managed today. This is a ritual, not a test."
      />

      {errorMessage && (
        <div className="mt-6">
          <ErrorNotice>{errorMessage}</ErrorNotice>
        </div>
      )}

      {hasFinishedToday && !editingFinishedCheckin && (
        <Card tone="accent" className="mt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-white"
                aria-hidden="true"
              >
                ✓
              </span>
              <div>
                <p className="font-semibold text-foreground">
                  Today is checked in.
                </p>
                <p className="mt-1 text-sm leading-5 text-muted">
                  {completedCount} of {totalCount} items marked complete. You can
                  still edit today if something changes.
                </p>
              </div>
            </div>
            <Button onClick={() => setEditingFinishedCheckin(true)}>
              Edit check-in
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-6 space-y-6">
        <Card>
          <SectionHeading
            title="Today's routines"
            description="Mark what happened, not what should have happened."
          />

          {routines.length === 0 ? (
            <div className="mt-4">
              <EmptyState>No routines are planned for today.</EmptyState>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {routines.map((routine) => (
                <CheckinChoice
                  key={routine.id}
                  title={routine.title}
                  detail={formatRoutineTime(routine)}
                  completed={isItemCompleted("routine", routine.id)}
                  locked={checkinLocked}
                  onToggle={() => toggleItem("routine", routine.id)}
                />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionHeading
            title="Today's tasks"
            description="One-off items can count too."
          />

          {tasks.length === 0 ? (
            <div className="mt-4">
              <EmptyState>No unfinished tasks are planned for today.</EmptyState>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {tasks.map((task) => (
                <CheckinChoice
                  key={task.id}
                  title={task.title}
                  detail={formatTaskTime(task)}
                  completed={isItemCompleted("task", task.id)}
                  locked={checkinLocked}
                  onToggle={() => toggleItem("task", task.id)}
                />
              ))}
            </div>
          )}
        </Card>

        <div
          className={`rounded-[1.4rem] border p-4 shadow-card sm:p-5 ${
            hasFinishedToday && !editingFinishedCheckin
              ? "border-primary/15 bg-primary-soft/45"
              : "sticky bottom-4 border-primary/15 bg-surface/95 backdrop-blur"
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  <span className="font-semibold text-foreground">
                    {completedCount}
                  </span>
                  {` of ${totalCount} marked complete`}
                </p>
                <span className="text-xs font-medium text-primary">
                  {completionPercent}%
                </span>
              </div>
              <ProgressBar value={completedCount} max={totalCount} />
            </div>

            {hasFinishedToday && !editingFinishedCheckin ? (
              <Button onClick={() => router.push("/dashboard")}>
                Back to today
              </Button>
            ) : (
              <div className="flex gap-2">
                {editingFinishedCheckin && (
                  <Button
                    variant="ghost"
                    disabled={saving}
                    onClick={cancelFinishedCheckinEdit}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  variant="primary"
                  className="sm:min-w-36"
                  disabled={saving || !userId}
                  onClick={finishDay}
                >
                  {saving
                    ? "Saving…"
                    : editingFinishedCheckin
                      ? "Save changes"
                      : "Finish day"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
