"use client";
import { useEffect, useRef, useState } from "react";
import { addLogEntry, deleteLogEntry, loadFoodDay, type FoodDay } from "@/lib/db/foodLog";
import { dailyTargets, dayTotals, type LogDraft } from "@/lib/nutrition/log";

// Food log entries are health data: kept in memory only, never in the offline
// snapshot, browser storage, push payloads or logs.
const UNDO_MS = 5000;

/** Today's food totals and quick add. Server-seeded; refetched on a new day. */
export function useFoodToday(
  userId: string,
  initialDayKey: string | null,
  initialState: FoodDay | null,
  todayKey: string,
) {
  const [state, setState] = useState<FoodDay | null>(initialState);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [undo, setUndo] = useState<{ id: string; label: string } | null>(null);
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

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  async function reload() {
    setState(await loadFoodDay(userId, todayKey));
  }

  async function add(draft: LogDraft) {
    if (busy) return false;
    setBusy(true);
    setFailed(false);
    try {
      const id = await addLogEntry(userId, todayKey, draft);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setUndo({ id, label: draft.label });
      undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
      await reload().catch(() => undefined);
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function undoLast() {
    const target = undo;
    if (!target || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await deleteLogEntry(userId, target.id);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setUndo(null);
      await reload().catch(() => undefined);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const loaded = state?.day === todayKey ? state : null;
  return {
    loaded: loaded !== null,
    // No new prompt on Today for people who don't track food: the card shows
    // once there is a body profile or something has been logged.
    visible: loaded !== null && (loaded.profile !== null || loaded.recent.length > 0),
    targets: loaded
      ? dailyTargets(loaded.profile, loaded.weighIns, loaded.adjustments, todayKey)
      : null,
    totals: dayTotals(loaded?.entries ?? []),
    count: loaded?.entries.length ?? 0,
    recent: loaded?.recent ?? [],
    busy,
    failed,
    undo,
    add,
    undoLast,
  };
}
