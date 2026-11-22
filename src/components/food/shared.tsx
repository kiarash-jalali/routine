"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";
import type { Nutrition, Per100g } from "@/lib/nutrition/food";
import { FOOD_TAGS, RECIPE_TAGS, localizedName } from "@/lib/nutrition/recipe";

type Per100Row = {
  kcal_100g: number;
  protein_100g: number;
  fat_100g: number;
  carbs_100g: number;
  fiber_100g: number;
};

export function per100(row: Per100Row | null | undefined): Per100g | null {
  if (!row) return null;
  return {
    kcal: Number(row.kcal_100g),
    protein: Number(row.protein_100g),
    fat: Number(row.fat_100g),
    carbs: Number(row.carbs_100g),
    fiber: Number(row.fiber_100g),
  };
}

const knownTags = new Set<string>([...RECIPE_TAGS, ...FOOD_TAGS]);

/** Formatting helpers in the user's language (digits, units, name fallback). */
export function useFoodFormat() {
  const { t, number, language } = useLanguage();
  return {
    kcal: (value: number) => t("food.kcalValue", { value: number(Math.round(value)) }),
    grams: (value: number) => t("food.gramsValue", { value: number(Math.round(value * 10) / 10) }),
    protein: (value: number) => t("food.proteinValue", { value: number(Math.round(value)) }),
    name: (en: string | null | undefined, fa: string | null | undefined) =>
      localizedName(language, en, fa),
    category: (value: string) => t(`food.category.${value}` as TranslationKey),
    tag: (value: string) => t(`food.tag.${value}` as TranslationKey),
  };
}

/** Small tag chips; tags without a translation are not shown. */
export function TagChips({ tags }: { tags: ReadonlyArray<string> }) {
  const format = useFoodFormat();
  const visible = tags.filter((tag) => knownTags.has(tag));
  if (visible.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {visible.map((tag) => (
        <li
          key={tag}
          className="rounded-lg bg-surface-soft px-2 py-0.5 text-xs font-medium text-muted"
        >
          {format.tag(tag)}
        </li>
      ))}
    </ul>
  );
}

export function isKnownTag(tag: string) {
  return knownTags.has(tag);
}

/** Two-step delete: the first tap asks, the second one deletes. */
export function ConfirmDelete({
  label,
  question,
  busy,
  onConfirm,
}: {
  label: string;
  question: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <Button variant="ghost" size="sm" onClick={() => setAsking(true)}>
        <Icon name="trash" size={16} />
        {label}
      </Button>
    );
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      <p className="text-sm text-muted">{question}</p>
      <Button variant="danger" size="sm" busy={busy} onClick={onConfirm}>
        {t("common.delete")}
      </Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setAsking(false)}>
        {t("common.cancel")}
      </Button>
    </div>
  );
}

/** Calories and macros in a compact grid; integers in the UI (§4.4). */
export function NutritionGrid({ value }: { value: Nutrition }) {
  const { t, number } = useLanguage();
  const rows: Array<[TranslationKey, string]> = [
    ["food.kcalLabel", number(Math.round(value.kcal))],
    ["food.proteinLabel", t("food.gramsValue", { value: number(Math.round(value.protein)) })],
    ["food.fatLabel", t("food.gramsValue", { value: number(Math.round(value.fat)) })],
    ["food.carbsLabel", t("food.gramsValue", { value: number(Math.round(value.carbs)) })],
    ["food.fiberLabel", t("food.gramsValue", { value: number(Math.round(value.fiber)) })],
  ];
  return (
    <dl className="grid grid-cols-3 gap-3 sm:grid-cols-5">
      {rows.map(([label, text]) => (
        <div key={label} className="min-w-0 rounded-xl bg-surface-soft px-3 py-2">
          <dt className="text-xs text-muted">{t(label)}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-foreground">
            <bdi>{text}</bdi>
          </dd>
        </div>
      ))}
    </dl>
  );
}
