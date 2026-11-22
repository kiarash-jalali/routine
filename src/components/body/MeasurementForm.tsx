"use client";

import { useState } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { NumberField, RANGES, readNumber } from "./fields";
import type { BodyMeasurement, MeasurementInput } from "@/types/body";

const text = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

/**
 * Add or edit one day's measurement. Adding sends only the values typed, so
 * it never clears what that day already has; editing sends every field.
 */
export function MeasurementForm({
  initial,
  today,
  busy,
  onSave,
  onCancel,
}: {
  initial?: BodyMeasurement | undefined;
  today: string;
  busy: boolean;
  onSave: (values: MeasurementInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [day, setDay] = useState(initial?.measured_on ?? today);
  const [weight, setWeight] = useState(text(initial?.weight_kg));
  const [waist, setWaist] = useState(text(initial?.waist_cm));
  const [bodyFat, setBodyFat] = useState(text(initial?.body_fat_pct));
  const [note, setNote] = useState(initial?.note ?? "");
  const [submitted, setSubmitted] = useState(false);

  const parsed = {
    weight: readNumber(weight, RANGES.weight),
    waist: readNumber(waist, RANGES.waist),
    bodyFat: readNumber(bodyFat, RANGES.bodyFat),
  };
  const anyInvalid = Object.values(parsed).some((value) => value === "invalid");
  const noValue = Object.values(parsed).every((value) => value === null);
  const dayInvalid = !/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today;

  return (
    <form
      noValidate
      className="mt-5 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (anyInvalid || noValue || dayInvalid || busy) return;
        const value = (v: number | null | "invalid") => (typeof v === "number" ? v : null);
        const trimmed = note.trim() || null;
        if (initial) {
          void onSave({
            measured_on: day,
            weight_kg: value(parsed.weight),
            waist_cm: value(parsed.waist),
            body_fat_pct: value(parsed.bodyFat),
            note: trimmed,
          });
          return;
        }
        const values: MeasurementInput = { measured_on: day };
        if (parsed.weight !== null) values.weight_kg = value(parsed.weight);
        if (parsed.waist !== null) values.waist_cm = value(parsed.waist);
        if (parsed.bodyFat !== null) values.body_fat_pct = value(parsed.bodyFat);
        if (trimmed) values.note = trimmed;
        void onSave(values);
      }}
    >
      <fieldset disabled={busy} className="space-y-5">
        <label className="grid gap-2 text-sm">
          {t("body.date")}
          <Input
            type="date"
            required
            max={today}
            value={day}
            invalid={submitted && dayInvalid}
            onChange={(event) => setDay(event.target.value)}
          />
        </label>
        <div className="grid gap-5 sm:grid-cols-3">
          <NumberField
            label={t("body.weight")}
            value={weight}
            onChange={setWeight}
            range={RANGES.weight}
            showError={submitted}
          />
          <NumberField
            label={t("body.waist")}
            value={waist}
            onChange={setWaist}
            range={RANGES.waist}
            showError={submitted}
          />
          <NumberField
            label={t("body.bodyFat")}
            value={bodyFat}
            onChange={setBodyFat}
            range={RANGES.bodyFat}
            showError={submitted}
          />
        </div>
        {submitted && noValue && (
          <p className="field-error">{t("body.oneValue")}</p>
        )}
        <label className="grid gap-2 text-sm">
          {t("body.note")}
          <Textarea
            rows={2}
            maxLength={300}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </fieldset>
      <div className="form-actions-sticky flex gap-3">
        <Button onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="primary" busy={busy} disabled={busy}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
