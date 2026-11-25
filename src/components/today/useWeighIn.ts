"use client";
import { useEffect, useState } from "react";
import { getWeighInState, saveMeasurement } from "@/lib/db/body";
import type { WeighInState } from "@/types/body";

// Holds only the day key: "dismissed for today" is a per-device convenience
// and never stores a body value. Body data is never put in the offline snapshot.
const DISMISS_KEY = "rootine-weigh-in-dismissed";

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

/** Today's weigh-in card state. One field, one tap; same day updates. */
export function useWeighIn(
  userId: string,
  initialDayKey: string | null,
  initialState: WeighInState | null,
  todayKey: string,
) {
  // Seed with the server's state so hydration matches; the effect below
  // refetches when the device's day differs from the server's.
  const [state, setState] = useState<WeighInState | null>(initialState);
  const [dismissedDay, setDismissedDay] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // localStorage only exists after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissedDay(readDismissed());
  }, []);

  useEffect(() => {
    if (initialDayKey === todayKey && initialState) return;
    let cancelled = false;
    getWeighInState(userId, todayKey)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initialDayKey, initialState, todayKey, userId]);

  function dismiss() {
    setDismissedDay(todayKey);
    try {
      window.localStorage.setItem(DISMISS_KEY, todayKey);
    } catch {
      // Private mode: dismissal lasts for this page only.
    }
  }

  async function save(weightKg: number, waistCm: number | null) {
    if (saving || !state) return false;
    setSaving(true);
    setFailed(false);
    try {
      await saveMeasurement(userId, {
        measured_on: todayKey,
        weight_kg: weightKg,
        ...(waistCm === null ? {} : { waist_cm: waistCm }),
      });
      setState({
        ...state,
        today: {
          id: state.today?.id ?? "",
          weight_kg: weightKg,
          waist_cm: waistCm ?? state.today?.waist_cm ?? null,
        },
      });
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setSaving(false);
    }
  }

  const weekday = new Date(`${todayKey}T12:00:00`).getDay();
  const visible =
    Boolean(state?.hasProfile) &&
    state?.today?.weight_kg == null &&
    dismissedDay !== todayKey;

  return {
    visible,
    weekStartsOn: state?.hasProfile ? state.weekStartsOn : null,
    askWaist: state !== null && weekday === state.weekStartsOn,
    saving,
    failed,
    save,
    dismiss,
  };
}
