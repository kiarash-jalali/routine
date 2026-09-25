"use client";

import { useId, useState } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import { ScheduleFields } from "@/components/life/ScheduleFields";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { getDeviceTimeZone } from "@/lib/schedule";
import type { MedicationInput, MedicationPlan } from "@/types/health";

export function MedicationForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial?: MedicationPlan | undefined;
  busy: boolean;
  onSave: (values: MedicationInput) => Promise<void>;
  onCancel?: (() => void) | undefined;
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
  const [touched, setTouched] = useState({
    name: false,
    times: false,
    days: false,
  });
  const errorBaseId = useId();

  const change = <K extends keyof MedicationInput>(
    key: K,
    value: MedicationInput[K],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const nameError = !values.name.trim();
  const missingTime = values.times.length === 0 || values.times.some((time) => !time);
  const duplicateTimes = new Set(values.times).size !== values.times.length;
  const timesError = missingTime || duplicateTimes;
  const daysError = values.days_of_week.length === 0;
  const valid = !nameError && !timesError && !daysError;

  return (
    <form
      className="mt-5 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched({ name: true, times: true, days: true });
        if (!valid || busy) return;
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
            required
            maxLength={120}
            value={values.name}
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
          {t("health.dose")}
          <Input
            maxLength={120}
            value={values.dose}
            onChange={(event) => change("dose", event.target.value)}
          />
          <span className="text-muted">{t("health.doseBody")}</span>
        </label>

        <fieldset
          aria-invalid={touched.times && timesError}
          aria-describedby={
            touched.times && timesError ? `${errorBaseId}-times` : undefined
          }
        >
          <legend className="mb-2 text-sm">{t("health.times")}</legend>
          <div className="space-y-2">
            {values.times.map((reminderTime, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="time"
                  required
                  invalid={
                    touched.times &&
                    (!reminderTime || duplicateTimes)
                  }
                  aria-label={t("health.timeNumber", {
                    number: number(index + 1),
                  })}
                  value={reminderTime}
                  onBlur={() =>
                    setTouched((current) => ({ ...current, times: true }))
                  }
                  onChange={(event) =>
                    change(
                      "times",
                      values.times.map((value, valueIndex) =>
                        valueIndex === index ? event.target.value : value,
                      ),
                    )
                  }
                />
                {values.times.length > 1 && (
                  <Button
                    onClick={() => {
                      setTouched((current) => ({ ...current, times: true }));
                      change(
                        "times",
                        values.times.filter((_, valueIndex) => valueIndex !== index),
                      );
                    }}
                  >
                    {t("common.delete")}
                  </Button>
                )}
              </div>
            ))}
          </div>
          {touched.times && timesError && (
            <p id={`${errorBaseId}-times`} className="field-error mt-2">
              {duplicateTimes ? t("health.uniqueTimes") : t("form.required")}
            </p>
          )}
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
          onDays={(value) => {
            setTouched((current) => ({ ...current, days: true }));
            change("days_of_week", value);
          }}
          daysInvalid={touched.days && daysError}
          daysErrorId={`${errorBaseId}-days`}
          daysError={t("routine.chooseOne")}
          timezone={values.timezone}
          onTimezone={(value) => change("timezone", value)}
          start={values.start_date ?? ""}
          end={values.end_date ?? ""}
          onStart={(value) => change("start_date", value || null)}
          onEnd={(value) => change("end_date", value || null)}
        />

        <label className="grid gap-2 text-sm">
          {t("common.notes")}
          <Textarea
            rows={3}
            maxLength={2000}
            value={values.notes}
            onChange={(event) => change("notes", event.target.value)}
          />
        </label>
        <p className="text-sm text-muted">{t("health.privacy")}</p>
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
