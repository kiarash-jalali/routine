"use client";

import { useState, type FormEvent } from "react";
import { MomentSource } from "@/components/MomentPopup";
import { Button, Input, SegmentedControl } from "@/components/ui";
import { Collapse } from "@/components/Motion";
import { ROUTINE_DAYS } from "@/lib/routineSchedule";
import type { RoutineFormValues } from "@/types/routine";

import { useLanguage } from "@/components/preferences/LanguageProvider";

type RoutineFormProps = {
  initialValues: RoutineFormValues;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: RoutineFormValues) => Promise<void>;
  onCancel?: () => void;
  shineSubmit?: boolean;
  momentSourceId?: string;
};

export function RoutineForm({
  initialValues,
  submitLabel,
  submittingLabel,
  isSubmitting,
  onSubmit,
  onCancel,
  shineSubmit = false,
  momentSourceId,
}: RoutineFormProps) {
  const { t, weekday, language } = useLanguage();
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

  const submitButton = (
    <Button
      type="submit"
      variant="primary"
      className={`flex-1 ${shineSubmit ? "moment-shine" : ""}`}
      disabled={!canSubmit || isSubmitting}
      busy={isSubmitting}
    >
      {isSubmitting ? submittingLabel : submitLabel}
    </Button>
  );

  return (
    <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
      <fieldset disabled={isSubmitting} className="space-y-6">
        <label className="grid gap-2 text-sm font-medium">
          {t("common.name")}
          <Input
            placeholder={t("routine.placeholder")}
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
          <p className="text-sm font-medium">{t("routine.repeat")}</p>
          <SegmentedControl
            label={t("routine.frequency")}
            value={values.frequency}
            options={[
              { value: "daily", label: t("common.daily") },
              { value: "weekly", label: t("common.chooseDays") },
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
              {t("common.days")}
            </legend>
            <div className="grid grid-cols-7 gap-1.5">
              {ROUTINE_DAYS.map((day) => (
                <button
                  key={day.value}
                  className="day-chip"
                  type="button"
                  aria-label={weekday(day.value, "long")}
                  title={weekday(day.value, "long")}
                  aria-pressed={values.daysOfWeek.includes(day.value)}
                  onClick={() => toggleDay(day.value)}
                >
                  {weekday(day.value, language === "fa" ? "narrow" : "short")}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted">{t("routine.chooseOne")}</p>
          </fieldset>
        </Collapse>
        <label className="grid gap-2 text-sm font-medium">
          {t("routine.time")}
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
            {t("routine.gentle")}
          </span>
        </label>
      </fieldset>
      <div className="flex gap-3">
        {onCancel && (
          <Button onClick={onCancel} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
        )}
        {momentSourceId ? (
          <MomentSource id={momentSourceId} className="flex flex-1">
            {submitButton}
          </MomentSource>
        ) : (
          submitButton
        )}
      </div>
    </form>
  );
}
