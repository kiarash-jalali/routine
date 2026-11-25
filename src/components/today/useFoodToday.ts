"use client";
import { useEffect, useRef, useState } from "react";
import { addLogEntry, deleteLogEntry, loadFoodDay, type FoodDay, type FoodLogEntry } from "@/lib/db/foodLog";
import { loadPlannedMeals, type PlannedDay, type TodayPlannedMeal } from "@/lib/db/mealPlan";
import { dailyTargets, dayTotals, entryFromPlan, type LogDraft } from "@/lib/nutrition/log";

// Food log entries are health data: kept in memory only, never in the offline
// snapshot, browser storage, push payloads or logs.
const UNDO_MS = 5000;

/** Today's food totals, planned meals and quick add. Server-seeded; refetched on a new day. */
export function useFoodToday(
  userId: string,
  initialDayKey: string | null,
  initialState: FoodDay | null,
  initialPlanned: PlannedDay | null,
  todayKey: string,
) {
  const [state, setState] = useState<FoodDay | null>(initialState);
  const [planned, setPlanned] = useState<PlannedDay | null>(initialPlanned);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [undo, setUndo] = useState<{ id: string; label: string } | null>(null);
  // State updates land after the render; the ref stops a double tap in between.
  const inFlight = useRef(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialDayKey === todayKey && initialState) return;
    let cancelled = false;
    loadFoodDay(userId, todayKey)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initialDayKey, initialState, todayKey, userId]);

  useEffect(() => {
    if (initialPlanned?.day === todayKey) return;
    let cancelled = false;
    loadPlannedMeals(userId, todayKey)
      .then((next) => {
        if (!cancelled) setPlanned(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initialPlanned, todayKey, userId]);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  async function reload() {
    setState(await loadFoodDay(userId, todayKey));
  }

  /** The plan may have changed elsewhere (meal logged or removed on another device). */
  async function reloadAll() {
    await Promise.allSettled([
      reload(),
      loadPlannedMeals(userId, todayKey).then(setPlanned),
    ]);
  }

  async function add(draft: LogDraft) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const id = await addLogEntry(userId, todayKey, draft);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setUndo({ id, label: draft.label });
      // Shown at once, so a failed refresh never hides a saved entry.
      const entry: FoodLogEntry = {
        ...draft,
        id,
        eaten_on: todayKey,
        note: null,
        created_at: new Date().toISOString(),
      };
      setState((current) =>
        current?.day === todayKey
          ? { ...current, entries: [...current.entries, entry], recent: [entry, ...current.recent] }
          : current,
      );
      await reload().catch(() => undefined);
      // Counted from when the refresh ends: Undo is disabled while busy.
      undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
      return true;
    } catch (error: unknown) {
      const already = error instanceof Error && error.message === "food_log_already_logged";
      if (!already) setFailed(true);
      if (draft.meal_plan_entry_id) await reloadAll();
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  /** "Ate as planned": one tap, snapshotting the nutrition shown. */
  function logPlanned(meal: TodayPlannedMeal, portions: number, label: string) {
    return add(entryFromPlan(meal, portions, label));
  }

  async function undoLast() {
    const target = undo;
    if (!target || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await deleteLogEntry(userId, target.id);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setUndo(null);
      setState((current) =>
        current && {
          ...current,
          entries: current.entries.filter((entry) => entry.id !== target.id),
          recent: current.recent.filter((entry) => entry.id !== target.id),
        },
      );
      await reload().catch(() => undefined);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const loaded = state?.day === todayKey ? state : null;
  // Hidden until the log is loaded too, so a logged meal never looks unlogged.
  const meals = loaded && planned?.day === todayKey ? planned.meals : [];
  return {
    loaded: loaded !== null,
    // No new prompt on Today for people who don't track food: the card shows
    // once there is a body profile, a logged entry or a meal planned for today.
    visible: loaded !== null &&
      (loaded.profile !== null || loaded.recent.length > 0 || meals.length > 0),
    targets: loaded
      ? dailyTargets(loaded.profile, loaded.weighIns, loaded.adjustments, todayKey)
      : null,
    totals: dayTotals(loaded?.entries ?? []),
    count: loaded?.entries.length ?? 0,
    planned: meals.map((meal) => ({
      meal,
      logged: loaded?.entries.find((entry) => entry.meal_plan_entry_id === meal.id) ?? null,
    })),
    recent: loaded?.recent ?? [],
    busy,
    failed,
    undo,
    add,
    logPlanned,
    undoLast,
  };
}
