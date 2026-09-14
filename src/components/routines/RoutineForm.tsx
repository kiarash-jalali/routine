"use client";

import {
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Button, Input, Select } from "@/components/ui";
import { ROUTINE_DAYS } from "@/lib/routineSchedule";
import type { RoutineFormValues } from "@/types/routine";

type RoutineFormProps = {
  initialValues: RoutineFormValues;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: RoutineFormValues) => Promise<void>;
  onCancel?: () => void;
};

export function RoutineForm({
  initialValues,
  submitLabel,
  submittingLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: RoutineFormProps) {
  const [values, setValues] = useState<RoutineFormValues>(initialValues);

  const canSubmit = useMemo(() => {
    if (!values.title.trim() || !values.preferredTime.trim()) return false;
    if (values.frequency === "weekly" && values.daysOfWeek.length === 0) {
      return false;
    }
    return true;
  }, [values]);

  function toggleDay(day: number) {
    setValues((current) => {
      const nextDays = current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((value) => value !== day)
        : [...current.daysOfWeek, day];

      return {
        ...current,
        daysOfWeek: nextDays.sort((a, b) => a - b),
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    await onSubmit({
      ...values,
      title: values.title.trim(),
    });
  }

  return (
    <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-foreground">Name</span>
        <Input
          placeholder="Reading, vitamins, stretching…"
          value={values.title}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setValues((current) => ({
              ...current,
              title: event.target.value,
            }))
          }
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-foreground">Frequency</span>
          <Select
            value={values.frequency}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setValues((current) => ({
                ...current,
                frequency: event.target.value as RoutineFormValues["frequency"],
              }))
            }
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </Select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-foreground">
            Preferred time
          </span>
          <Input
            type="time"
            value={values.preferredTime}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setValues((current) => ({
                ...current,
                preferredTime: event.target.value,
              }))
            }
            required
          />
        </label>
      </div>

      {values.frequency === "weekly" && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            Days of week
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-4 xl:grid-cols-7">
            {ROUTINE_DAYS.map((day) => {
              const active = values.daysOfWeek.includes(day.value);

              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`min-h-10 rounded-xl border px-2.5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-ring ${
                    active
                      ? "border-primary bg-primary text-white shadow-button"
                      : "border-border-strong bg-surface text-muted hover:border-primary/25 hover:bg-primary-soft/40 hover:text-foreground"
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">
            Pick at least one day for a weekly routine.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>

        {onCancel && (
          <Button
            type="button"
            className="sm:min-w-24"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
