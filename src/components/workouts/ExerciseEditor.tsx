"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, EmptyState, Input } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { parseExerciseLines, parseRepScheme } from "@/lib/workouts/structured";
import type { PlanExercise, PlanExerciseInput, WorkoutPlan } from "@/types/workout";

type Row = PlanExerciseInput & { key: string };

let nextKey = 0;
const newKey = () => `row-${(nextKey += 1)}`;

function toRows(exercises: PlanExercise[]): Row[] {
  return exercises.map((exercise) => ({
    key: exercise.id,
    id: exercise.id,
    name: exercise.name,
    target_sets: exercise.target_sets,
    rep_scheme: exercise.rep_scheme,
    rest_seconds: exercise.rest_seconds,
    notes: exercise.notes,
  }));
}

export function ExerciseEditor({
  plan,
  exercises,
  busy,
  onSave,
  onCancel,
}: {
  plan: WorkoutPlan;
  exercises: PlanExercise[];
  busy: boolean;
  onSave: (rows: PlanExerciseInput[]) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const baseId = useId();
  const [rows, setRows] = useState<Row[]>(() => toRows(exercises));
  const [converted, setConverted] = useState(false);
  const [touched, setTouched] = useState(false);

  const invalid = (row: Row) => ({
    name: !row.name.trim(),
    scheme: !parseRepScheme(row.rep_scheme),
  });
  const valid = rows.every((row) => {
    const problems = invalid(row);
    return !problems.name && !problems.scheme;
  });

  function update(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function move(index: number, delta: number) {
    setRows((current) => {
      const next = [...current];
      const target = index + delta;
      const [item] = next.splice(index, 1);
      if (!item || target < 0 || target > next.length) return current;
      next.splice(target, 0, item);
      return next;
    });
  }

  function convert() {
    const parsed = parseExerciseLines(plan.exercises);
    setRows((current) => [
      ...current,
      ...parsed.map((item) => ({
        key: newKey(),
        name: item.name,
        target_sets: item.target_sets,
        rep_scheme: item.rep_scheme,
        rest_seconds: null,
        notes: null,
      })),
    ]);
    setConverted(true);
    setTouched(true);
  }

  return (
    <form
      className="mt-5 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (!valid || busy) return;
        void onSave(
          rows.map((row) => ({
            id: row.id,
            name: row.name,
            target_sets: parseRepScheme(row.rep_scheme)?.sets ?? row.target_sets,
            rep_scheme: row.rep_scheme,
            rest_seconds: row.rest_seconds,
            notes: row.notes,
          })),
        );
      }}
    >
      {plan.exercises.trim() && !converted && rows.length === 0 && (
        <Button onClick={convert} disabled={busy}>
          {t("workout.structured.convert")}
        </Button>
      )}
      {converted && (
        <p className="text-sm leading-6 text-muted">{t("workout.structured.convertBody")}</p>
      )}
      {rows.length === 0 && <EmptyState>{t("workout.structured.empty")}</EmptyState>}

      <fieldset disabled={busy} className="space-y-4">
        {rows.map((row, index) => {
          const problems = invalid(row);
          const label = row.name.trim() || t("workout.structured.exerciseName");
          return (
            <div key={row.key} className="rounded-2xl border border-border p-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <label className="grid gap-2 text-sm">
                  {t("workout.structured.exerciseName")}
                  <Input
                    value={row.name}
                    maxLength={120}
                    required
                    invalid={touched && problems.name}
                    describedBy={touched && problems.name ? `${baseId}-${row.key}-name` : undefined}
                    onChange={(event) => update(row.key, { name: event.target.value })}
                  />
                  {touched && problems.name && (
                    <span id={`${baseId}-${row.key}-name`} className="field-error">
                      {t("form.required")}
                    </span>
                  )}
                </label>
                <label className="grid gap-2 text-sm">
                  {t("workout.structured.scheme")}
                  <Input
                    value={row.rep_scheme}
                    maxLength={40}
                    dir="ltr"
                    invalid={touched && problems.scheme}
                    describedBy={`${baseId}-${row.key}-scheme`}
                    onChange={(event) => update(row.key, { rep_scheme: event.target.value })}
                  />
                </label>
              </div>
              <p
                id={`${baseId}-${row.key}-scheme`}
                className={touched && problems.scheme ? "field-error mt-2" : "mt-2 text-xs text-muted"}
              >
                {touched && problems.scheme
                  ? t("workout.structured.schemeInvalid")
                  : t("workout.structured.schemeHint")}
              </p>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <label className="grid gap-2 text-sm">
                  {t("workout.structured.rest")}
                  <Input
                    type="number"
                    min={0}
                    max={900}
                    step={5}
                    className="w-32"
                    value={row.rest_seconds ?? ""}
                    onChange={(event) =>
                      update(row.key, {
                        rest_seconds: event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                  />
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t("workout.structured.moveUp", { name: label })}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <Icon name="chevron" size={16} className="-rotate-90" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t("workout.structured.moveDown", { name: label })}
                    disabled={index === rows.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <Icon name="chevron" size={16} className="rotate-90" />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={t("workout.structured.remove", { name: label })}
                    onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {rows.length < 50 && (
          <Button
            onClick={() =>
              setRows((current) => [
                ...current,
                { key: newKey(), name: "", target_sets: 3, rep_scheme: "3x10", rest_seconds: null, notes: null },
              ])
            }
          >
            <Icon name="plus" size={16} />
            {t("workout.structured.add")}
          </Button>
        )}
      </fieldset>

      <div className="form-actions-sticky flex gap-3">
        <Button onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button
          className="flex-1"
          type="submit"
          variant="primary"
          busy={busy}
          disabled={busy || (touched && !valid)}
        >
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
