"use client";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { ScheduleFields } from "@/components/life/ScheduleFields";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { getDeviceTimeZone, localClock } from "@/lib/schedule";
import type { SessionInput, WorkoutInput, WorkoutPlan } from "@/types/workout";
export function WorkoutForm({
  initial,
  busy,
  onSave,
  onLog,
}: {
  initial?: WorkoutPlan | undefined;
  busy: boolean;
  onSave?: ((values: WorkoutInput) => Promise<void>) | undefined;
  onLog?: ((values: SessionInput) => Promise<void>) | undefined;
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
  const change = <K extends keyof WorkoutInput>(
    key: K,
    value: WorkoutInput[K],
  ) => setValues((v) => ({ ...v, [key]: value }));
  const valid =
    values.name.trim() &&
    values.activity_type.trim() &&
    values.duration_minutes >= 1 &&
    values.duration_minutes <= 1440 &&
    (onLog || values.days_of_week.length);
  return (
    <form
      className="mt-5 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
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
        } else
          void onSave?.({
            ...values,
            name: values.name.trim(),
            activity_type: values.activity_type.trim(),
          });
      }}
    >
      <fieldset disabled={busy} className="space-y-5">
        <label className="grid gap-2 text-sm">
          {t("workout.name")}
          <Input
            required
            value={values.name}
            maxLength={120}
            onChange={(e) => change("name", e.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm">
          {t("workout.activity")}
          <Input
            required
            value={values.activity_type}
            maxLength={80}
            onChange={(e) => change("activity_type", e.target.value)}
          />
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
            onChange={(e) => change("duration_minutes", Number(e.target.value))}
          />
        </label>
        {onLog && (
          <label className="grid gap-2 text-sm">
            {t("workout.date")}
            <Input
              type="date"
              required
              max={localClock(new Date(), timezone).day}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
        )}
        <label className="grid gap-2 text-sm">
          {t("common.time")}
          <Input
            type="time"
            required
            value={values.preferred_time.slice(0, 5)}
            max={
              onLog && day === localClock(new Date(), timezone).day
                ? localClock(new Date(), timezone).time
                : undefined
            }
            onChange={(e) => change("preferred_time", e.target.value)}
          />
        </label>
        {!onLog && (
          <ScheduleFields
            days={values.days_of_week}
            onDays={(v) => change("days_of_week", v)}
            timezone={values.timezone}
            onTimezone={(v) => change("timezone", v)}
          />
        )}
        <label className="grid gap-2 text-sm">
          {t("workout.exercises")}
          <textarea
            className="field"
            rows={4}
            maxLength={4000}
            value={values.exercises}
            onChange={(e) => change("exercises", e.target.value)}
          />
        </label>
        {!onLog && (
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={values.reminders_enabled}
              onChange={(e) => change("reminders_enabled", e.target.checked)}
            />
            {t("schedule.reminders")}
          </label>
        )}
      </fieldset>
      <Button
        type="submit"
        variant="primary"
        busy={busy}
        disabled={busy || !valid}
      >
        {t("common.save")}
      </Button>
    </form>
  );
}
