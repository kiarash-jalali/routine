"use client";
import { useLanguage } from "@/components/preferences/LanguageProvider";

import { useEffect, useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import {
  MomentPopup,
  MomentSource,
  type MomentNotice,
} from "@/components/MomentPopup";
import { AnimatedNumber, AnimatedSwap, Collapse } from "@/components/Motion";
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
  submitDailyCheckin,
} from "@/lib/db/checkins";
import { listTasks, setTaskCompletionStates } from "@/lib/db/tasks";
import { listTodaysRoutines } from "@/lib/db/today";
import { getErrorMessage } from "@/lib/errors";
import { getMomentCopy } from "@/lib/moments";
import { getSessionUser } from "@/lib/session";
import {
  filterTasksForToday,
  getLocalDateKey,
} from "@/lib/today";
import { useToday } from "@/lib/useToday";
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
          <span className="data-text mt-1 block text-xs text-muted">
            {detail}
          </span>
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

export default function CheckinPage() {
  const { t, date, time, number } = useLanguage();
  const router = useRouter();
  const todayDate = useToday();
  const today = getLocalDateKey(todayDate);
  const todayLabel = date(todayDate, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [moment, setMoment] = useState<MomentNotice | null>(null);

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
        const user = await getSessionUser();
        if (!user) {
          router.replace("/login");
          return;
        }

        const dayDate = new Date(`${today}T12:00:00`);
        const [todaysRoutines, allTasks, existingCheckin] = await Promise.all([
          listTodaysRoutines(dayDate),
          listTasks(),
          findDailyCheckin(user.id, today),
        ]);

        const existingItems = existingCheckin
          ? await listCheckinItems(existingCheckin.id)
          : [];
        const todaysTasks = filterTasksForToday(allTasks, dayDate);
        const existingCompletionMap = createCompletionMap(existingItems);

        if (!existingCheckin?.submitted_at) {
          for (const task of todaysTasks) {
            existingCompletionMap[createItemKey("task", task.id)] = task.is_done;
          }
        }

        if (cancelled) return;

        setUserId(user.id);
        setDailyCheckinId(existingCheckin?.id ?? null);
        setRoutines(todaysRoutines);
        setTasks(todaysTasks);
        setCompletionByItem(existingCompletionMap);
        setSavedCompletionByItem(existingCompletionMap);
        setHasFinishedToday(Boolean(existingCheckin?.submitted_at));
        setEditingFinishedCheckin(false);
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(
            getErrorMessage(error, t("checkin.loadError")),
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
    const willComplete = !completionByItem[itemKey];

    setCompletionByItem((current) => ({
      ...current,
      [itemKey]: !current[itemKey],
    }));

    if (willComplete) {
      const copy = getMomentCopy(
        itemType === "routine"
          ? "checkin_routine_completed"
          : "checkin_task_completed",
      );
      setMoment({
        id: `checkin-${itemKey}-${Date.now()}`,
        ...copy,
        sourceId: `checkin-${itemType}-${itemId}`,
        icon: "check",
        tone: "success",
      });
    }
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

      await Promise.all([
        saveCheckinItems([...routineItems, ...taskItems]),
        setTaskCompletionStates(
          userId,
          taskItems.map((item) => ({
            id: item.item_id,
            completed: item.completed,
          })),
        ),
      ]);
      await submitDailyCheckin(checkinId);
      setDailyCheckinId(checkinId);
      setSavedCompletionByItem({ ...completionByItem });
      setHasFinishedToday(true);
      setEditingFinishedCheckin(false);

      const copy = getMomentCopy("day_saved");
      setMoment({
        id: `day-saved-${Date.now()}`,
        ...copy,
        sourceId: "finish-day",
        icon: "checkin",
        tone: "warm",
        durationMs: 3200,
      });
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(error, t("checkin.saveError")),
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
        <LoadingState label={t("common.loading")} />
      </PageShell>
    );

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        eyebrow={todayLabel}
        title={t("product.checkinTitle")}
        description={t("product.checkinBody")}
      />
      {errorMessage && (
        <div className="mb-6">
          <ErrorNotice>{errorMessage}</ErrorNotice>
        </div>
      )}
      <Collapse show={hasFinishedToday && !editingFinishedCheckin}>
        <Card tone="accent" className="mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="success-mark" aria-hidden="true">
              <Icon name="check" size={25} />
            </span>
            <div className="min-w-0 flex-1" role="status">
              <h2 className="reflection-title">
                {t("product.checkinSavedTitle")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                {t("product.checkinSavedBody")}
              </p>
            </div>
            <Button onClick={() => setEditingFinishedCheckin(true)}>
              {t("product.editCheckin")}
            </Button>
          </div>
        </Card>
      </Collapse>
      <div className="space-y-6">
        <Card>
          <SectionHeading
            title={t("nav.routines")}
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
              <EmptyState>{t("product.noRoutines")}</EmptyState>
            ) : (
              routines.map((routine) => (
                <MomentSource
                  key={routine.id}
                  id={`checkin-routine-${routine.id}`}
                  className="block w-full"
                >
                  <CheckinChoice
                    title={routine.title}
                    detail={
                      routine.preferred_time
                        ? t("routine.preferredAt", {
                            time: time(routine.preferred_time),
                          })
                        : undefined
                    }
                    completed={isItemCompleted("routine", routine.id)}
                    locked={checkinLocked}
                    onToggle={() => toggleItem("routine", routine.id)}
                  />
                </MomentSource>
              ))
            )}
          </div>
        </Card>
        <Card>
          <SectionHeading
            title={t("product.tasks")}
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
              <EmptyState>{t("product.noTasks")}</EmptyState>
            ) : (
              tasks.map((task) => (
                <MomentSource
                  key={task.id}
                  id={`checkin-task-${task.id}`}
                  className="block w-full"
                >
                  <CheckinChoice
                    title={task.title}
                    detail={
                      task.due_at
                        ? t("task.dueAt", {
                            time: date(task.due_at, {
                              hour: "2-digit",
                              minute: "2-digit",
                            }),
                          })
                        : t("task.flexible")
                    }
                    completed={isItemCompleted("task", task.id)}
                    locked={checkinLocked}
                    onToggle={() => toggleItem("task", task.id)}
                  />
                </MomentSource>
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
                    <AnimatedNumber value={completedCount} />
                  </span>{" "}
                  {t("product.completedOf", {
                    completed: number(completedCount),
                    total: number(totalCount),
                  })}
                </p>
                <span className="data-text text-xs text-primary">
                  <AnimatedNumber value={`${completionPercent}%`} />
                </span>
              </div>
              <ProgressBar value={completedCount} max={totalCount} />
            </div>
            <AnimatedSwap
              value={
                hasFinishedToday && !editingFinishedCheckin
                  ? "finished"
                  : "editing"
              }
            >
              {hasFinishedToday && !editingFinishedCheckin ? (
                <Link href="/dashboard" className="btn btn-secondary">
                  {t("product.backToday")}
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
                      {t("common.cancel")}
                    </Button>
                  )}
                  <MomentSource id="finish-day" className="flex flex-1">
                    <Button
                      variant="primary"
                      className="flex-1 sm:min-w-36"
                      disabled={saving || !userId}
                      onClick={finishDay}
                      busy={saving}
                    >
                      {saving
                        ? t("common.saving")
                        : editingFinishedCheckin
                          ? t("product.saveChanges")
                          : t("product.finishCheckin")}
                      {!saving && <Icon name="check" size={17} />}
                    </Button>
                  </MomentSource>
                </div>
              )}
            </AnimatedSwap>
          </div>
        </div>
        <p className="text-center text-sm text-muted">
          {t("product.unfinishedCounts")}
        </p>
      </div>

      <MomentPopup notice={moment} onDismiss={() => setMoment(null)} />
    </PageShell>
  );
}
