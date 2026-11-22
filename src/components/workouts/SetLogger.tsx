"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { CheckCircle, ErrorNotice, Input, Pill } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import {
  deleteSetLog,
  previousSetLogs,
  listSetLogs,
  saveSetLog,
} from "@/lib/db/workoutExercises";
import { readyToProgress, targetRepsFor } from "@/lib/workouts/structured";
import type { PlanExercise, SetLog, WorkoutSession } from "@/types/workout";

type Draft = { reps: string; weight: string };
const key = (exerciseId: string, setNumber: number) => `${exerciseId}:${setNumber}`;

export function SetLogger({
  userId,
  session,
  exercises,
}: {
  userId: string;
  session: WorkoutSession;
  exercises: PlanExercise[];
}) {
  const { t, number } = useLanguage();
  const [logged, setLogged] = useState<Map<string, SetLog>>(new Map());
  const [previous, setPrevious] = useState<SetLog[]>([]);
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [invalid, setInvalid] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [current, last] = await Promise.all([
          listSetLogs(userId, session.id),
          session.workout_id
            ? previousSetLogs(userId, session.workout_id, session.id)
            : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setLogged(new Map(current.map((log) => [key(log.exercise_id, log.set_number), log])));
        setPrevious(last);
        // A reload (for example when the tab becomes visible again) must not
        // overwrite values the user is typing: only fill drafts that are missing.
        setDrafts((existing) => {
          const nextDrafts = new Map(existing);
          for (const exercise of exercises) {
            for (let set = 1; set <= exercise.target_sets; set += 1) {
              const id = key(exercise.id, set);
              if (nextDrafts.has(id)) continue;
              const source =
                current.find((log) => log.exercise_id === exercise.id && log.set_number === set) ??
                last.find((log) => log.exercise_id === exercise.id && log.set_number === set);
              nextDrafts.set(id, {
                reps: String(source?.reps ?? targetRepsFor(exercise.rep_scheme, set) ?? ""),
                weight: source?.weight_kg == null ? "" : String(source.weight_kg),
              });
            }
          }
          return nextDrafts;
        });
        setLoaded(true);
      } catch {
        if (!cancelled) setError(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [exercises, session.id, session.workout_id, userId]);

  function setDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => {
      const next = new Map(current);
      next.set(id, { reps: "", weight: "", ...current.get(id), ...patch });
      return next;
    });
  }

  async function toggle(exercise: PlanExercise, setNumber: number) {
    const id = key(exercise.id, setNumber);
    if (pending.has(id)) return;
    const draft = drafts.get(id);
    const repsText = draft?.reps.trim() ?? "";
    const weightText = draft?.weight.trim() ?? "";
    const reps = Number(repsText);
    // The database stores weight with one decimal; round so the screen matches.
    const weight = weightText ? Math.round(Number(weightText) * 10) / 10 : null;
    const existing = logged.get(id);
    if (
      !existing &&
      (repsText === "" ||
        !Number.isInteger(reps) ||
        reps < 0 ||
        reps > 200 ||
        (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 500)))
    ) {
      setInvalid(id);
      return;
    }

    setInvalid(null);
    setPending((current) => new Set(current).add(id));
    setError(false);
    try {
      if (existing) {
        await deleteSetLog(userId, session.id, exercise.id, setNumber);
        setLogged((current) => {
          const next = new Map(current);
          next.delete(id);
          return next;
        });
      } else {
        await saveSetLog(userId, {
          session_id: session.id,
          exercise_id: exercise.id,
          set_number: setNumber,
          reps,
          weight_kg: weight,
        });
        setLogged((current) =>
          new Map(current).set(id, {
            id,
            session_id: session.id,
            exercise_id: exercise.id,
            user_id: userId,
            set_number: setNumber,
            reps,
            weight_kg: weight,
            band_level: null,
            rpe: null,
            completed_at: new Date().toISOString(),
          }),
        );
      }
    } catch {
      setError(true);
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  if (error && !loaded) {
    return (
      <div className="mt-5">
        <ErrorNotice>{t("workout.structured.loadError")}</ErrorNotice>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-5">
      {error && <ErrorNotice>{t("common.error")}</ErrorNotice>}
      {exercises.map((exercise) => {
        const last = previous.filter((log) => log.exercise_id === exercise.id);
        const bodyweight = last.every((log) => log.weight_kg == null);
        return (
          <section key={exercise.id} className="rounded-2xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold">
                  <bdi>{exercise.name}</bdi>
                </h3>
                <p className="mt-1 text-sm text-muted" dir="ltr">
                  {exercise.rep_scheme}
                </p>
              </div>
              {readyToProgress(exercise.rep_scheme, last) && (
                <Pill>
                  <Icon name="spark" size={14} />
                  {t(
                    bodyweight
                      ? "workout.structured.progressBodyweight"
                      : "workout.structured.progress",
                  )}
                </Pill>
              )}
            </div>
            <ul className="mt-3">
              {Array.from({ length: exercise.target_sets }, (_, index) => index + 1).map((setNumber) => {
                const id = key(exercise.id, setNumber);
                const done = logged.has(id);
                const draft = drafts.get(id) ?? { reps: "", weight: "" };
                const labelValues = { number: number(setNumber), name: exercise.name };
                const isInvalid = invalid === id;
                return (
                  <li key={id} className={`list-row flex-wrap ${done ? "is-done" : ""}`}>
                    <button
                      type="button"
                      className="check-control -ms-2"
                      aria-pressed={done}
                      aria-label={t(
                        done ? "workout.structured.undoSet" : "workout.structured.logSet",
                        labelValues,
                      )}
                      disabled={!loaded || pending.has(id)}
                      onClick={() => void toggle(exercise, setNumber)}
                    >
                      <CheckCircle checked={done} />
                    </button>
                    <span className="w-16 shrink-0 text-sm text-muted">
                      {t("workout.structured.setLabel", { number: number(setNumber) })}
                    </span>
                    <label className="grid gap-1 text-xs text-muted">
                      {t("workout.structured.reps")}
                      <Input
                        type="number"
                        inputMode="numeric"
                        size="sm"
                        min={0}
                        max={200}
                        className="w-20"
                        value={draft.reps}
                        disabled={done}
                        aria-invalid={isInvalid || undefined}
                        onChange={(event) => setDraft(id, { reps: event.target.value })}
                      />
                    </label>
                    <label className="grid gap-1 text-xs text-muted">
                      {t("workout.structured.weight")}
                      <Input
                        type="number"
                        inputMode="decimal"
                        size="sm"
                        min={0}
                        max={500}
                        step={0.5}
                        className="w-24"
                        value={draft.weight}
                        disabled={done}
                        aria-invalid={isInvalid || undefined}
                        onChange={(event) => setDraft(id, { weight: event.target.value })}
                      />
                    </label>
                    {isInvalid && (
                      <p role="alert" className="basis-full text-sm text-danger">
                        {t("workout.structured.invalidSet")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
