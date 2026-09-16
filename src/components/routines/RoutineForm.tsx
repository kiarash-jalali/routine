"use client";

import { useState, type FormEvent } from "react";
import { Button, Input, SegmentedControl } from "@/components/ui";
import { Collapse } from "@/components/Motion";
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
  const canSubmit = Boolean(
    values.title.trim() &&
    values.preferredTime.trim() &&
    (values.frequency === "daily" || values.daysOfWeek.length),
  );

  function toggleDay(day: number) {
    setValues((current) => ({
      ...current,
      daysOfWeek: (current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((value) => value !== day)
        : [...current.daysOfWeek, day]
      ).sort((a, b) => a - b),
    }));
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;
    await onSubmit({ ...values, title: values.title.trim() });
  }

  return (
    <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
      <fieldset disabled={isSubmitting} className="space-y-6">
        <label className="grid gap-2 text-sm font-medium">
          Name
          <Input
            autoFocus
            placeholder="Read a few pages"
            value={values.title}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            required
          />
        </label>
        <div className="space-y-2">
          <p className="text-sm font-medium">Repeat</p>
          <SegmentedControl
            label="Routine frequency"
            value={values.frequency}
            options={[
              { value: "daily", label: "Every day" },
              { value: "weekly", label: "Choose days" },
            ]}
            onChange={(frequency) =>
              setValues((current) => ({ ...current, frequency }))
            }
            disabled={isSubmitting}
          />
        </div>
        <Collapse show={values.frequency === "weekly"}>
          <fieldset>
            <legend className="mb-3 text-sm font-medium">
              Days of the week
            </legend>
            <div className="grid grid-cols-7 gap-1.5">
              {ROUTINE_DAYS.map((day) => (
                <button
                  key={day.value}
                  className="day-chip"
                  type="button"
                  aria-pressed={values.daysOfWeek.includes(day.value)}
                  onClick={() => toggleDay(day.value)}
                >
                  {day.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted">Choose at least one day.</p>
          </fieldset>
        </Collapse>
        <label className="grid gap-2 text-sm font-medium">
          Preferred time
          <Input
            type="time"
            value={values.preferredTime}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                preferredTime: event.target.value,
              }))
            }
            required
          />
          <span className="text-sm font-normal text-muted">
            A gentle plan, not a deadline.
          </span>
        </label>
      </fieldset>
      <div className="flex gap-3">
        {onCancel && (
          <Button onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          disabled={!canSubmit || isSubmitting}
          busy={isSubmitting}
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
