"use client";

import { useId, type ReactNode } from "react";
import { Input, Select } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import {
  ACTIVITY_MULTIPLIERS,
  GAIN_RATES,
  LOSE_RATES,
  parseDecimal,
  type ActivityLevel,
} from "@/lib/nutrition/body";
import type { BodyProfile, BodyProfileInput } from "@/types/body";

export type Range = { min: number; max: number; integer?: boolean };
export const RANGES = {
  height: { min: 100, max: 250 },
  // Adult formulas: at least 13 years old. Gregorian years only.
  birthYear: { min: 1900, max: new Date().getFullYear() - 13, integer: true },
  weight: { min: 20, max: 400 },
  waist: { min: 40, max: 250 },
  bodyFat: { min: 2, max: 75 },
  kcal: { min: 800, max: 6000, integer: true },
  protein: { min: 10, max: 400, integer: true },
} satisfies Record<string, Range>;

/** Empty → null, in range → number, otherwise "invalid". */
export function readNumber(text: string, range: Range): number | null | "invalid" {
  const value = parseDecimal(text);
  if (value === null) return null;
  if (
    Number.isNaN(value) ||
    value < range.min ||
    value > range.max ||
    (range.integer && !Number.isInteger(value))
  )
    return "invalid";
  return value;
}

export function NumberField({
  label,
  value,
  onChange,
  range,
  showError,
  required = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  range: Range;
  showError: boolean;
  required?: boolean;
  hint?: ReactNode;
}) {
  const { t, locale } = useLanguage();
  const errorId = useId();
  const plain = (value: number) =>
    new Intl.NumberFormat(locale, { useGrouping: false }).format(value);
  const parsed = readNumber(value, range);
  const invalid = showError && (parsed === "invalid" || (required && parsed === null));
  return (
    <label className="grid gap-2 text-sm">
      {label}
      <Input
        inputMode={range.integer ? "numeric" : "decimal"}
        autoComplete="off"
        value={value}
        required={required}
        invalid={invalid}
        describedBy={invalid ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <span className="text-muted">{hint}</span>}
      {invalid && (
        <span id={errorId} className="field-error">
          {t("body.invalidNumber", {
            min: plain(range.min),
            max: plain(range.max),
          })}
        </span>
      )}
    </label>
  );
}

/** Profile form state: numbers kept as typed text until saved. */
export type ProfileDraft = {
  sex: "" | "male" | "female";
  birthYear: string;
  height: string;
  activity: ActivityLevel;
  goalMode: "lose" | "maintain" | "gain";
  goalRate: number;
  goalWeight: string;
  kcalOverride: string;
  proteinMode: "auto" | "limit" | "custom";
  proteinGrams: string;
  weekStartsOn: number;
};

const text = (value: number | null) => (value === null ? "" : String(value));

export function draftFromProfile(
  profile: BodyProfile | null,
  weekStartsOn: number,
): ProfileDraft {
  return {
    sex: profile?.sex === "male" || profile?.sex === "female" ? profile.sex : "",
    birthYear: text(profile?.birth_year ?? null),
    height: text(profile?.height_cm ?? null),
    activity:
      profile && profile.activity_level in ACTIVITY_MULTIPLIERS
        ? (profile.activity_level as ActivityLevel)
        : "light",
    goalMode:
      profile?.goal_mode === "lose" || profile?.goal_mode === "gain"
        ? profile.goal_mode
        : "maintain",
    goalRate: profile?.goal_rate_kg_week ?? 0.5,
    goalWeight: text(profile?.goal_weight_kg ?? null),
    kcalOverride: text(profile?.kcal_target_override ?? null),
    proteinMode:
      profile?.protein_mode === "limit" || profile?.protein_mode === "custom"
        ? profile.protein_mode
        : "auto",
    proteinGrams: text(profile?.protein_grams ?? null),
    weekStartsOn: profile?.week_starts_on ?? weekStartsOn,
  };
}

export function ratesFor(goalMode: ProfileDraft["goalMode"]): readonly number[] {
  if (goalMode === "lose") return LOSE_RATES;
  if (goalMode === "gain") return GAIN_RATES;
  return [];
}

export const basicsValid = (draft: ProfileDraft) =>
  typeof readNumber(draft.height, RANGES.height) === "number" &&
  typeof readNumber(draft.birthYear, RANGES.birthYear) === "number";
export const goalValid = (draft: ProfileDraft) =>
  readNumber(draft.goalWeight, RANGES.weight) !== "invalid";
export const proteinValid = (draft: ProfileDraft) =>
  draft.proteinMode === "auto" ||
  typeof readNumber(draft.proteinGrams, RANGES.protein) === "number";
export const overrideValid = (draft: ProfileDraft) =>
  readNumber(draft.kcalOverride, RANGES.kcal) !== "invalid";

/** Draft → row values. Call only when the validators above pass. */
export function profileFromDraft(draft: ProfileDraft): BodyProfileInput {
  const num = (value: string, range: Range) => {
    const parsed = readNumber(value, range);
    return typeof parsed === "number" ? parsed : null;
  };
  const rates = ratesFor(draft.goalMode);
  return {
    sex: draft.sex || null,
    birth_year: num(draft.birthYear, RANGES.birthYear) ?? 1990,
    height_cm: num(draft.height, RANGES.height) ?? 170,
    activity_level: draft.activity,
    goal_mode: draft.goalMode,
    goal_rate_kg_week: rates.includes(draft.goalRate)
      ? draft.goalRate
      : (rates[0] ?? null),
    goal_weight_kg: num(draft.goalWeight, RANGES.weight),
    kcal_target_override: num(draft.kcalOverride, RANGES.kcal),
    protein_mode: draft.proteinMode,
    protein_grams:
      draft.proteinMode === "auto" ? null : num(draft.proteinGrams, RANGES.protein),
    week_starts_on: draft.weekStartsOn,
  };
}

type Change = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => void;

function Choices<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; body?: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm">{legend}</legend>
      <div className="grid gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="checkin-choice"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <span className="min-w-0">
              <span className="block font-medium">{option.label}</span>
              {option.body && (
                <span className="mt-1 block text-sm leading-6 text-muted">
                  {option.body}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function BasicsFields({
  draft,
  change,
  showErrors,
}: {
  draft: ProfileDraft;
  change: Change;
  showErrors: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField
          label={t("body.height")}
          value={draft.height}
          onChange={(value) => change("height", value)}
          range={RANGES.height}
          showError={showErrors}
          required
        />
        <NumberField
          label={t("body.birthYear")}
          value={draft.birthYear}
          onChange={(value) => change("birthYear", value)}
          range={RANGES.birthYear}
          showError={showErrors}
          required
          hint={t("body.birthYearHint")}
        />
      </div>
      <label className="grid gap-2 text-sm">
        {t("body.sex")}
        <Select
          value={draft.sex}
          onChange={(event) => change("sex", event.target.value as ProfileDraft["sex"])}
        >
          <option value="">{t("body.sexUnset")}</option>
          <option value="female">{t("body.sexFemale")}</option>
          <option value="male">{t("body.sexMale")}</option>
        </Select>
      </label>
      <label className="grid gap-2 text-sm">
        {t("body.activity")}
        <Select
          value={draft.activity}
          onChange={(event) => change("activity", event.target.value as ActivityLevel)}
        >
          {(Object.keys(ACTIVITY_MULTIPLIERS) as ActivityLevel[]).map((level) => (
            <option key={level} value={level}>
              {t(`body.activity.${level}`)}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}

export function GoalFields({
  draft,
  change,
  showErrors,
}: {
  draft: ProfileDraft;
  change: Change;
  showErrors: boolean;
}) {
  const { t, number } = useLanguage();
  const rates = ratesFor(draft.goalMode);
  return (
    <div className="space-y-5">
      <Choices
        legend={t("body.goal")}
        value={draft.goalMode}
        onChange={(value) => change("goalMode", value)}
        options={[
          { value: "lose", label: t("body.goal.lose") },
          { value: "maintain", label: t("body.goal.maintain") },
          { value: "gain", label: t("body.goal.gain") },
        ]}
      />
      {rates.length > 0 && (
        <label className="grid gap-2 text-sm">
          {t("body.rate")}
          <Select
            value={String(rates.includes(draft.goalRate) ? draft.goalRate : rates[0])}
            onChange={(event) => change("goalRate", Number(event.target.value))}
          >
            {rates.map((rate) => (
              <option key={rate} value={rate}>
                {t("body.rateValue", { rate: number(rate) })}
              </option>
            ))}
          </Select>
        </label>
      )}
      <NumberField
        label={t("body.goalWeight")}
        value={draft.goalWeight}
        onChange={(value) => change("goalWeight", value)}
        range={RANGES.weight}
        showError={showErrors}
      />
    </div>
  );
}

export function ProteinFields({
  draft,
  change,
  showErrors,
}: {
  draft: ProfileDraft;
  change: Change;
  showErrors: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-5">
      <Choices
        legend={t("body.proteinMode")}
        value={draft.proteinMode}
        onChange={(value) => change("proteinMode", value)}
        options={[
          { value: "auto", label: t("body.protein.auto"), body: t("body.protein.autoBody") },
          { value: "limit", label: t("body.protein.limit"), body: t("body.protein.limitBody") },
          { value: "custom", label: t("body.protein.custom"), body: t("body.protein.customBody") },
        ]}
      />
      {draft.proteinMode !== "auto" && (
        <NumberField
          label={t("body.proteinGrams")}
          value={draft.proteinGrams}
          onChange={(value) => change("proteinGrams", value)}
          range={RANGES.protein}
          showError={showErrors}
          required
        />
      )}
    </div>
  );
}

/** Sunday-first indexes (0–6) → the provider's ISO weekday (1 = Monday … 7 = Sunday). */
export const isoWeekday = (sundayFirst: number) => (sundayFirst === 0 ? 7 : sundayFirst);

export function MoreProfileFields({
  draft,
  change,
  showErrors,
}: {
  draft: ProfileDraft;
  change: Change;
  showErrors: boolean;
}) {
  const { t, weekday } = useLanguage();
  return (
    <div className="space-y-5">
      <NumberField
        label={t("body.kcalOverride")}
        value={draft.kcalOverride}
        onChange={(value) => change("kcalOverride", value)}
        range={RANGES.kcal}
        showError={showErrors}
        hint={t("body.kcalOverrideBody")}
      />
      <label className="grid gap-2 text-sm">
        {t("body.weekStart")}
        <Select
          value={String(draft.weekStartsOn)}
          onChange={(event) => change("weekStartsOn", Number(event.target.value))}
        >
          {[6, 0, 1].map((day) => (
            <option key={day} value={day}>
              {weekday(isoWeekday(day), "long")}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
