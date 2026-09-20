"use client";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { ScheduleFields } from "@/components/life/ScheduleFields";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { getDeviceTimeZone } from "@/lib/schedule";
import type { MedicationInput, MedicationPlan } from "@/types/health";
export function MedicationForm({
  initial,
  busy,
  onSave,
}: {
  initial?: MedicationPlan | undefined;
  busy: boolean;
  onSave: (values: MedicationInput) => Promise<void>;
}) {
  const { t, number } = useLanguage();
  const [values, setValues] = useState<MedicationInput>(
    () =>
      initial ?? {
        name: "",
        dose: "",
        notes: "",
        times: ["09:00"],
        days_of_week: [1, 2, 3, 4, 5, 6, 7],
        timezone: getDeviceTimeZone(),
        is_active: true,
        reminders_enabled: false,
        start_date: null,
        end_date: null,
      },
  );
  const change = <K extends keyof MedicationInput>(
    key: K,
    value: MedicationInput[K],
  ) => setValues((current) => ({ ...current, [key]: value }));
  const valid =
    values.name.trim() &&
    values.times.length &&
    values.times.every(Boolean) &&
    values.days_of_week.length &&
    new Set(values.times).size === values.times.length;
  return (
    <form
      className="mt-5 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid)
          void onSave({
            ...values,
            name: values.name.trim(),
            times: [...values.times].sort(),
          });
      }}
    >
      <fieldset disabled={busy} className="space-y-5">
        <label className="grid gap-2 text-sm">
          {t("health.name")}
          <Input
            autoFocus
            required
            maxLength={120}
            value={values.name}
            onChange={(e) => change("name", e.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm">
          {t("health.dose")}
          <Input
            maxLength={120}
            value={values.dose}
            onChange={(e) => change("dose", e.target.value)}
          />
          <span className="text-muted">{t("health.doseBody")}</span>
        </label>
        <fieldset>
          <legend className="mb-2 text-sm">{t("health.times")}</legend>
          <div className="space-y-2">
            {values.times.map((time, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="time"
                  required
                  aria-label={t("health.timeNumber", {
                    number: number(index + 1),
                  })}
                  value={time}
                  onChange={(e) =>
                    change(
                      "times",
                      values.times.map((v, i) =>
                        i === index ? e.target.value : v,
                      ),
                    )
                  }
                />
                {values.times.length > 1 && (
                  <Button
                    onClick={() =>
                      change(
                        "times",
                        values.times.filter((_, i) => i !== index),
                      )
                    }
                  >
                    {t("common.delete")}
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            className="mt-2"
            disabled={values.times.length >= 12}
            onClick={() => change("times", [...values.times, ""])}
          >
            {t("health.addTime")}
          </Button>
        </fieldset>
        <ScheduleFields
          days={values.days_of_week}
          onDays={(v) => change("days_of_week", v)}
          timezone={values.timezone}
          onTimezone={(v) => change("timezone", v)}
          start={values.start_date ?? ""}
          end={values.end_date ?? ""}
          onStart={(v) => change("start_date", v || null)}
          onEnd={(v) => change("end_date", v || null)}
        />
        <label className="grid gap-2 text-sm">
          {t("common.notes")}
          <textarea
            className="field"
            rows={3}
            maxLength={2000}
            value={values.notes}
            onChange={(e) => change("notes", e.target.value)}
          />
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={values.reminders_enabled}
            onChange={(e) => change("reminders_enabled", e.target.checked)}
          />
          {t("schedule.reminders")}
        </label>
        <p className="text-sm text-muted">{t("health.privacy")}</p>
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
