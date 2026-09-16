"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import {
  Button,
  CheckCircle,
  LoadingState,
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
      className="checkin-choice"
      aria-pressed={completed}
      disabled={locked}
      onClick={onToggle}
    >
      <CheckCircle checked={completed} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{title}</span>
        {detail && (
          <span className="mt-1 block text-[13px] text-muted">{detail}</span>
        )}
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
    if (!userId || saving) return;

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
  const checkinLocked = saving || (hasFinishedToday && !editingFinishedCheckin);

  if (loading)
    return (
      <PageShell className="max-w-3xl">
        <LoadingState label="Loading your check-in…" />
      </PageShell>
    );

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        eyebrow={todayLabel}
        title="Daily check-in"
        description="Notice what you did. Showing up is enough."
      />
      {errorMessage && (
        <div className="mb-6">
          <ErrorNotice>{errorMessage}</ErrorNotice>
        </div>
      )}
      {hasFinishedToday && !editingFinishedCheckin && (
        <Card tone="accent" className="notice mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="success-mark" aria-hidden="true">
              <Icon name="check" size={25} />
            </span>
            <div className="min-w-0 flex-1" role="status">
              <h2 className="text-lg font-semibold">
                A day worth acknowledging.
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Your check-in is saved. Come back to it if anything changes.
              </p>
            </div>
            <Button onClick={() => setEditingFinishedCheckin(true)}>
              Edit check-in
            </Button>
          </div>
        </Card>
      )}
      <div className="space-y-6">
        <Card>
          <SectionHeading
            title="Routines"
            action={
              <span className="text-sm text-muted">
                {
                  routines.filter((routine) =>
                    isItemCompleted("routine", routine.id),
                  ).length
                }{" "}
                / {routines.length}
              </span>
            }
          />
          <div className="mt-5 space-y-2.5">
            {routines.length === 0 ? (
              <EmptyState>No routines planned for today.</EmptyState>
            ) : (
              routines.map((routine) => (
                <CheckinChoice
                  key={routine.id}
                  title={routine.title}
                  detail={formatRoutineTime(routine)}
                  completed={isItemCompleted("routine", routine.id)}
                  locked={checkinLocked}
                  onToggle={() => toggleItem("routine", routine.id)}
                />
              ))
            )}
          </div>
        </Card>
        <Card>
          <SectionHeading
            title="Tasks"
            action={
              <span className="text-sm text-muted">
                {
                  tasks.filter((task) => isItemCompleted("task", task.id))
                    .length
                }{" "}
                / {tasks.length}
              </span>
            }
          />
          <div className="mt-5 space-y-2.5">
            {tasks.length === 0 ? (
              <EmptyState>No unfinished tasks planned for today.</EmptyState>
            ) : (
              tasks.map((task) => (
                <CheckinChoice
                  key={task.id}
                  title={task.title}
                  detail={formatTaskTime(task)}
                  completed={isItemCompleted("task", task.id)}
                  locked={checkinLocked}
                  onToggle={() => toggleItem("task", task.id)}
                />
              ))
            )}
          </div>
        </Card>
        <div className="checkin-footer">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  <span className="font-semibold text-foreground">
                    {completedCount}
                  </span>{" "}
                  of {totalCount} completed
                </p>
                <span className="text-xs font-medium text-primary">
                  {completionPercent}%
                </span>
              </div>
              <ProgressBar value={completedCount} max={totalCount} />
            </div>
            {hasFinishedToday && !editingFinishedCheckin ? (
              <Link href="/dashboard" className="btn btn-secondary">
                Back to today
                <Icon name="arrow" size={16} />
              </Link>
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
                  className="flex-1 sm:min-w-36"
                  disabled={saving || !userId}
                  onClick={finishDay}
                  busy={saving}
                >
                  {saving
                    ? "Saving…"
                    : editingFinishedCheckin
                      ? "Save changes"
                      : "Finish day"}
                  {!saving && <Icon name="check" size={17} />}
                </Button>
              </div>
            )}
          </div>
        </div>
        <p className="text-center text-sm text-muted">
          An unfinished day is still a day you showed up.
        </p>
      </div>
    </PageShell>
  );
}
