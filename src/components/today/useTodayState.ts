"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import {
  getDailyProgress,
  setDailyItemCompletion,
} from "@/lib/db/checkins";
import { getRhythmSummary, type RhythmSummary } from "@/lib/db/rhythm";
import {
  listMedicationRemindersForDay,
  setMedicationTaken,
} from "@/lib/db/health";
import {
  completeWorkout,
  listWorkoutSessionsForDay,
} from "@/lib/db/workouts";
import { getErrorMessage } from "@/lib/errors";
import { checkinItemKey, completionMapFromItems } from "@/lib/checkinProgress";
import {
  filterTasksForToday,
  getLocalDateKey,
  routineOccursOn,
} from "@/lib/today";
import { useToday } from "@/lib/useToday";
import { saveOfflineSnapshot } from "@/lib/offlineStore";
import type { CheckinCompletionMap } from "@/types/checkin";
import type { Routine } from "@/types/routine";
import type { Task } from "@/types/task";
import type { MedicationReminder } from "@/types/health";
import type { WorkoutSession } from "@/types/workout";
import type { WeighInState } from "@/types/body";
import type { FoodDay } from "@/lib/db/foodLog";
import { useMoment } from "./useMoment";
import { useWeighIn } from "./useWeighIn";
import { useFoodToday } from "./useFoodToday";

export type TodayInitialData = {
  userId: string;
  initialTasks: Task[];
  initialActiveRoutines: Routine[];
  initialRhythm: RhythmSummary | null;
  initialCompletionByItem: CheckinCompletionMap;
  initialDayKey: string | null;
  initialMedicationReminders: MedicationReminder[];
  initialWorkoutSessions: WorkoutSession[];
  initialWeighIn: WeighInState | null;
  initialFoodDay: FoodDay | null;
  initialPartialError: boolean;
};

export function useTodayState({
  userId,
  initialTasks,
  initialActiveRoutines,
  initialRhythm,
  initialCompletionByItem,
  initialDayKey,
  initialMedicationReminders,
  initialWorkoutSessions,
  initialWeighIn,
  initialFoodDay,
  initialPartialError,
}: TodayInitialData) {
  const { t, language } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [medicationReminders, setMedicationReminders] = useState(
    initialMedicationReminders,
  );
  const [workoutSessions, setWorkoutSessions] = useState(initialWorkoutSessions);
  const [rhythm, setRhythm] = useState<RhythmSummary | null>(initialRhythm);
  const [completionByItem, setCompletionByItem] =
    useState<CheckinCompletionMap>(initialCompletionByItem);
  const [offlineSnapshotDay, setOfflineSnapshotDay] = useState<string | null>(
    initialPartialError ? null : initialDayKey,
  );
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"today" | "all" | "done">("today");
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const { moment, setMoment, showMoment } = useMoment();
  const pending = useRef(new Set<string>());
  const today = useToday();
  const todayKey = getLocalDateKey(today);
  const weighIn = useWeighIn(userId, initialDayKey, initialWeighIn, todayKey);
  const food = useFoodToday(userId, initialDayKey, initialFoodDay, todayKey);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-translates on language change
    if (initialPartialError) setError(t("dashboard.partialLoadError"));
  }, [initialPartialError, t]);

  useEffect(() => {
    if (initialDayKey === todayKey && !initialPartialError) return;

    let cancelled = false;
    if (initialDayKey !== todayKey) {
      // Clear stale server data when the client's local day differs.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRhythm(null);
      setCompletionByItem({});
    }

    async function loadDay() {
      const results = await Promise.allSettled([
        getRhythmSummary(todayKey, 7),
        getDailyProgress(userId, todayKey),
        listMedicationRemindersForDay(userId, todayKey),
        listWorkoutSessionsForDay(userId, todayKey),
      ]);
      if (cancelled) return;

      const [
        rhythmResult,
        progressResult,
        medicationResult,
        workoutResult,
      ] = results;
      if (rhythmResult.status === "fulfilled") setRhythm(rhythmResult.value);
      if (progressResult.status === "fulfilled") {
        setCompletionByItem(completionMapFromItems(progressResult.value.items));
      }
      if (medicationResult.status === "fulfilled") {
        setMedicationReminders(medicationResult.value);
      }
      if (workoutResult.status === "fulfilled") {
        setWorkoutSessions(workoutResult.value);
      }
      if (results.some((result) => result.status === "rejected")) {
        setOfflineSnapshotDay(null);
        setError(t("dashboard.partialLoadError"));
      } else if (!initialPartialError) {
        setOfflineSnapshotDay(todayKey);
      }
    }

    void loadDay();
    return () => {
      cancelled = true;
    };
  }, [initialDayKey, initialPartialError, t, todayKey, userId]);

  function openTaskForm() {
    setFormError(null);
    setShowTaskForm(true);
  }

  function requestDelete(task: Task) {
    setFormError(null);
    setDeleteTarget(task);
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

  async function toggleMedication(reminder: MedicationReminder) {
    const pendingKey = `medication:${reminder.id}`;
    if (pending.current.has(pendingKey)) return;
    const wasTaken = Boolean(reminder.taken_at);
    const optimisticTakenAt = wasTaken ? null : new Date().toISOString();

    pending.current.add(pendingKey);
    setPendingIds([...pending.current]);
    setError(null);
    setMedicationReminders((current) =>
      current.map((item) =>
        item.id === reminder.id
          ? { ...item, taken_at: optimisticTakenAt }
          : item,
      ),
    );

    try {
      await setMedicationTaken(userId, reminder.id, !wasTaken);
    } catch (error: unknown) {
      setMedicationReminders((current) =>
        current.map((item) =>
          item.id === reminder.id
            ? { ...item, taken_at: reminder.taken_at }
            : item,
        ),
      );
      setError(getErrorMessage(error, t("common.error")));
    } finally {
      pending.current.delete(pendingKey);
      setPendingIds([...pending.current]);
    }
  }

  async function toggleWorkout(session: WorkoutSession) {
    const pendingKey = `workout:${session.id}`;
    if (pending.current.has(pendingKey)) return;
    const wasCompleted = Boolean(session.completed_at);
    const optimisticCompletedAt = wasCompleted ? null : new Date().toISOString();

    pending.current.add(pendingKey);
    setPendingIds([...pending.current]);
    setError(null);
    setWorkoutSessions((current) =>
      current.map((item) =>
        item.id === session.id
          ? { ...item, completed_at: optimisticCompletedAt }
          : item,
      ),
    );

    try {
      await completeWorkout(
        userId,
        session.id,
        !wasCompleted,
        session.duration_minutes,
      );
    } catch (error: unknown) {
      setWorkoutSessions((current) =>
        current.map((item) =>
          item.id === session.id
            ? { ...item, completed_at: session.completed_at }
            : item,
        ),
      );
      setError(getErrorMessage(error, t("common.error")));
    } finally {
      pending.current.delete(pendingKey);
      setPendingIds([...pending.current]);
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
  const todayMedication = useMemo(
    () =>
      medicationReminders
        .filter((reminder) => reminder.scheduled_day === todayKey)
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [medicationReminders, todayKey],
  );
  const todayWorkouts = useMemo(
    () =>
      workoutSessions
        .filter((session) => session.scheduled_day === todayKey)
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [todayKey, workoutSessions],
  );
  const checkedInToday = rhythm?.checkedInToday ?? false;
  const offlineTasks = useMemo(() => {
    const todayTaskIds = new Set(todayTasks.map((task) => task.id));
    return tasks.filter(
      (task) =>
        todayTaskIds.has(task.id) ||
        completionByItem[checkinItemKey("task", task.id)] === true,
    );
  }, [completionByItem, tasks, todayTasks]);

  useEffect(() => {
    if (offlineSnapshotDay !== todayKey) return;

    void saveOfflineSnapshot({
      version: 1,
      userId,
      language,
      savedAt: new Date().toISOString(),
      day: todayKey,
      checkedInToday,
      routines: routines.slice(0, 50).map((routine) => ({
        id: routine.id,
        title: routine.title,
        completed: Boolean(
          completionByItem[checkinItemKey("routine", routine.id)],
        ),
      })),
      tasks: offlineTasks.slice(0, 50).map((task) => ({
        id: task.id,
        title: task.title,
        completed:
          completionByItem[checkinItemKey("task", task.id)] ?? task.is_done,
      })),
    }).catch(() => undefined);
  }, [
    checkedInToday,
    completionByItem,
    language,
    offlineSnapshotDay,
    offlineTasks,
    routines,
    todayKey,
    userId,
  ]);

  return {
    userId,
    today,
    todayKey,
    tasks,
    setTasks,
    rhythm,
    completionByItem,
    error,
    pendingIds,
    moment,
    setMoment,
    showMoment,
    formError,
    setFormError,
    taskFilter,
    setTaskFilter,
    showTaskForm,
    setShowTaskForm,
    openTaskForm,
    deleteTarget,
    setDeleteTarget,
    requestDelete,
    toggleDone,
    toggleRoutine,
    toggleMedication,
    toggleWorkout,
    routines,
    todayTasks,
    todayMedication,
    todayWorkouts,
    checkedInToday,
    weighIn,
    food,
  };
}

export type TodayState = ReturnType<typeof useTodayState>;
