"use client";

import { useId, useState } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import { ScheduleFields } from "@/components/life/ScheduleFields";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { getDeviceTimeZone, localClock } from "@/lib/schedule";
import type { SessionInput, WorkoutInput, WorkoutPlan } from "@/types/workout";

export function WorkoutForm({
  initial,
  busy,
  onSave,
  onLog,
  onCancel,
}: {
  initial?: WorkoutPlan | undefined;
  busy: boolean;
  onSave?: ((values: WorkoutInput) => Promise<void>) | undefined;
  onLog?: ((values: SessionInput) => Promise<void>) | undefined;
  onCancel?: (() => void) | undefined;
}) {
  const { t } = useLanguage();
  const timezone = getDeviceTimeZone();
  const [values, setValues] = useState<WorkoutInput>(
    () =>
      initial ?? {
        name: "",
        activity_type: "",
        duration_minutes: 30,
        exercises: "",
        days_of_week: [1, 3, 5],
        preferred_time: onLog ? localClock(new Date(), timezone).time : "18:00",
        timezone,
        is_active: true,
        reminders_enabled: false,
      },
  );
  const [day, setDay] = useState(() => localClock(new Date(), timezone).day);
  const [touched, setTouched] = useState({
    name: false,
    activity: false,
    duration: false,
    days: false,
    time: false,
    day: false,
  });
  const errorBaseId = useId();

  const change = <K extends keyof WorkoutInput>(
    key: K,
    value: WorkoutInput[K],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const nameError = !values.name.trim();
  const activityError = !values.activity_type.trim();
  const durationError =
    !Number.isFinite(values.duration_minutes) ||
    values.duration_minutes < 1 ||
    values.duration_minutes > 1440;
  const daysError = !onLog && values.days_of_week.length === 0;
  const timeError = !values.preferred_time.trim();
  const dayError = Boolean(onLog && !day);
  const valid =
    !nameError &&
    !activityError &&
    !durationError &&
    !daysError &&
    !timeError &&
    !dayError;

  return (
    <form
      className="mt-5 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched({
          name: true,
          activity: true,
          duration: true,
          days: true,
          time: true,
          day: true,
        });
        if (!valid || busy) return;

        if (onLog) {
          const at = new Date(
            `${day}T${values.preferred_time}:00`,
          ).toISOString();
          void onLog({
            name: values.name.trim(),
            activity_type: values.activity_type.trim(),
            duration_minutes: values.duration_minutes,
            exercises: values.exercises,
            scheduled_day: day,
            scheduled_time: values.preferred_time,
            scheduled_at: at,
            timezone,
          });
        } else {
          void onSave?.({
            ...values,
            name: values.name.trim(),
            activity_type: values.activity_type.trim(),
          });
        }
      }}
    >
      <fieldset disabled={busy} className="space-y-5">
        <label className="grid gap-2 text-sm">
          {t("workout.name")}
          <Input
            required
            value={values.name}
            maxLength={120}
            invalid={touched.name && nameError}
            describedBy={
              touched.name && nameError ? `${errorBaseId}-name` : undefined
            }
            onBlur={() =>
              setTouched((current) => ({ ...current, name: true }))
            }
            onChange={(event) => change("name", event.target.value)}
          />
          {touched.name && nameError && (
            <span id={`${errorBaseId}-name`} className="field-error">
              {t("form.required")}
            </span>
          )}
        </label>

        <label className="grid gap-2 text-sm">
          {t("workout.activity")}
          <Input
            required
            value={values.activity_type}
            maxLength={80}
            invalid={touched.activity && activityError}
            describedBy={
              touched.activity && activityError
                ? `${errorBaseId}-activity`
                : undefined
            }
            onBlur={() =>
              setTouched((current) => ({ ...current, activity: true }))
            }
            onChange={(event) => change("activity_type", event.target.value)}
          />
          {touched.activity && activityError && (
            <span id={`${errorBaseId}-activity`} className="field-error">
              {t("form.required")}
            </span>
          )}
        </label>

        <label className="grid gap-2 text-sm">
          {t("workout.duration")}
          <Input
            type="number"
            min={1}
            max={1440}
            step={1}
            required
            value={values.duration_minutes || ""}
            invalid={touched.duration && durationError}
            describedBy={
              touched.duration && durationError
                ? `${errorBaseId}-duration`
                : undefined
            }
            onBlur={() =>
              setTouched((current) => ({ ...current, duration: true }))
            }
            onChange={(event) =>
              change("duration_minutes", Number(event.target.value))
            }
          />
          {touched.duration && durationError && (
            <span id={`${errorBaseId}-duration`} className="field-error">
              {t("workout.durationRange")}
            </span>
          )}
        </label>

        {onLog && (
          <label className="grid gap-2 text-sm">
            {t("workout.date")}
            <Input
              type="date"
              required
              max={localClock(new Date(), timezone).day}
              value={day}
              invalid={touched.day && dayError}
              describedBy={
                touched.day && dayError ? `${errorBaseId}-day` : undefined
              }
              onBlur={() =>
                setTouched((current) => ({ ...current, day: true }))
              }
              onChange={(event) => setDay(event.target.value)}
            />
            {touched.day && dayError && (
              <span id={`${errorBaseId}-day`} className="field-error">
                {t("form.required")}
              </span>
            )}
          </label>
        )}

        <label className="grid gap-2 text-sm">
          {t("common.time")}
          <Input
            type="time"
            required
            value={values.preferred_time.slice(0, 5)}
            invalid={touched.time && timeError}
            describedBy={
              touched.time && timeError ? `${errorBaseId}-time` : undefined
            }
            max={
              onLog && day === localClock(new Date(), timezone).day
                ? localClock(new Date(), timezone).time
                : undefined
            }
            onBlur={() =>
              setTouched((current) => ({ ...current, time: true }))
            }
            onChange={(event) => change("preferred_time", event.target.value)}
          />
          {touched.time && timeError && (
            <span id={`${errorBaseId}-time`} className="field-error">
              {t("form.required")}
            </span>
          )}
        </label>

        {!onLog && (
          <ScheduleFields
            days={values.days_of_week}
            onDays={(value) => {
              setTouched((current) => ({ ...current, days: true }));
              change("days_of_week", value);
            }}
            daysInvalid={touched.days && daysError}
            daysErrorId={`${errorBaseId}-days`}
            daysError={t("routine.chooseOne")}
            timezone={values.timezone}
            onTimezone={(value) => change("timezone", value)}
          />
        )}

        <label className="grid gap-2 text-sm">
          {t("workout.exercises")}
          <Textarea
            rows={4}
            maxLength={4000}
            value={values.exercises}
            onChange={(event) => change("exercises", event.target.value)}
          />
        </label>
      </fieldset>

      <div className="form-actions-sticky flex gap-3">
        {onCancel && (
          <Button onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </Button>
        )}
        <Button
          className="flex-1"
          type="submit"
          variant="primary"
          busy={busy}
          disabled={busy || !valid}
        >
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
