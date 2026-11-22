"use client";

import { useId, useState, type FormEvent } from "react";
import { Button, ErrorNotice, Input, Select } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import type { FoodInput, FoodRow } from "@/lib/db/food";
import type { TranslationKey } from "@/lib/i18n";
import { toLatinDigits } from "@/lib/nutrition/recipe";

type Field =
  | "kcal_100g"
  | "protein_100g"
  | "fat_100g"
  | "carbs_100g"
  | "fiber_100g";

const numberFields: Array<{ key: Field; label: TranslationKey; max: number }> = [
  { key: "kcal_100g", label: "food.kcal100", max: 950 },
  { key: "protein_100g", label: "food.protein100", max: 100 },
  { key: "fat_100g", label: "food.fat100", max: 100 },
  { key: "carbs_100g", label: "food.carbs100", max: 100 },
  { key: "fiber_100g", label: "food.fiber100", max: 100 },
];

type FormError = "name" | "number" | "macros" | null;

function text(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Validates and converts the form into a food row; the table checks match these. */
export function foodInputFromForm(values: Record<string, string>): FoodInput | FormError {
  const name_en = text(values.name_en ?? "");
  const name_fa = text(values.name_fa ?? "");
  if (!name_en && !name_fa) return "name";
  const numbers = {} as Record<Field, number>;
  for (const field of numberFields) {
    const raw = toLatinDigits(values[field.key] ?? "").trim();
    const value = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > field.max) return "number";
    numbers[field.key] = Math.round(value * 10) / 10;
  }
  if (numbers.protein_100g + numbers.fat_100g + numbers.carbs_100g > 100) return "macros";
  const servingRaw = toLatinDigits(values.serving_grams ?? "").trim();
  const serving = servingRaw === "" ? null : Number(servingRaw);
  if (serving !== null && (!Number.isFinite(serving) || serving <= 0 || serving > 5000))
    return "number";
  return {
    kind: values.kind === "dish" ? "dish" : "ingredient",
    name_en,
    name_fa,
    ...numbers,
    serving_grams: serving === null ? null : Math.round(serving * 10) / 10,
    serving_label_en: serving === null ? null : text(values.serving_label_en ?? "")?.slice(0, 80) ?? null,
    serving_label_fa: serving === null ? null : text(values.serving_label_fa ?? "")?.slice(0, 80) ?? null,
  };
}

export function FoodForm({
  initial,
  busy,
  error,
  onCancel,
  onSave,
}: {
  initial: FoodRow | null;
  busy: boolean;
  error: boolean;
  onCancel: () => void;
  onSave: (values: FoodInput) => void;
}) {
  const { t } = useLanguage();
  const id = useId();
  const [formError, setFormError] = useState<FormError>(null);
  const initialValue = (value: number | string | null | undefined) =>
    value === null || value === undefined ? "" : String(value);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(
      [...new FormData(event.currentTarget).entries()].map(([key, value]) => [key, String(value)]),
    );
    const result = foodInputFromForm(values);
    if (typeof result === "string" || result === null) {
      setFormError(result);
      return;
    }
    setFormError(null);
    onSave(result);
  }

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm" htmlFor={`${id}-name-en`}>
          {t("food.nameEn")}
          <Input id={`${id}-name-en`} name="name_en" maxLength={160} dir="ltr" defaultValue={initialValue(initial?.name_en)} invalid={formError === "name"} />
        </label>
        <label className="grid gap-2 text-sm" htmlFor={`${id}-name-fa`}>
          {t("food.nameFa")}
          <Input id={`${id}-name-fa`} name="name_fa" maxLength={160} dir="rtl" defaultValue={initialValue(initial?.name_fa)} invalid={formError === "name"} />
        </label>
      </div>
      <p className="text-xs text-muted">{t("food.nameHint")}</p>
      <label className="grid gap-2 text-sm" htmlFor={`${id}-kind`}>
        {t("food.kind")}
        <Select id={`${id}-kind`} name="kind" defaultValue={initial?.kind ?? "ingredient"}>
          <option value="ingredient">{t("food.kindSingle.ingredient")}</option>
          <option value="dish">{t("food.kindSingle.dish")}</option>
        </Select>
      </label>
      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">{t("food.per100")}</legend>
        {numberFields.map((field) => (
          <label key={field.key} className="grid gap-2 text-sm" htmlFor={`${id}-${field.key}`}>
            {t(field.label)}
            <Input
              id={`${id}-${field.key}`}
              name={field.key}
              inputMode="decimal"
              dir="ltr"
              defaultValue={initialValue(initial?.[field.key])}
              invalid={formError === "number" || (formError === "macros" && field.key !== "kcal_100g" && field.key !== "fiber_100g")}
            />
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-2 text-sm" htmlFor={`${id}-serving`}>
          {t("food.servingGrams")}
          <Input id={`${id}-serving`} name="serving_grams" inputMode="decimal" dir="ltr" defaultValue={initialValue(initial?.serving_grams)} />
        </label>
        <label className="grid gap-2 text-sm" htmlFor={`${id}-label-en`}>
          {t("food.servingLabelEn")}
          <Input id={`${id}-label-en`} name="serving_label_en" maxLength={80} dir="ltr" defaultValue={initialValue(initial?.serving_label_en)} />
        </label>
        <label className="grid gap-2 text-sm" htmlFor={`${id}-label-fa`}>
          {t("food.servingLabelFa")}
          <Input id={`${id}-label-fa`} name="serving_label_fa" maxLength={80} dir="rtl" defaultValue={initialValue(initial?.serving_label_fa)} />
        </label>
      </div>
      {formError && <ErrorNotice>{t(`food.formError.${formError}` as TranslationKey)}</ErrorNotice>}
      {error && <ErrorNotice>{t("food.actionError")}</ErrorNotice>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="primary" busy={busy}>
          {busy ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
