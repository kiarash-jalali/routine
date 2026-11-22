"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Button, Card, ErrorNotice, Input, SectionHeading, Select, Textarea } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { NutritionGrid, isKnownTag, per100, useFoodFormat } from "@/components/food/shared";
import { saveRecipe, type FoodRow, type RecipeDetail } from "@/lib/db/food";
import type { TranslationKey } from "@/lib/i18n";
import {
  MAX_INGREDIENTS,
  MAX_SERVINGS,
  MIN_SERVINGS,
  RECIPE_CATEGORIES,
  RECIPE_TAGS,
  parseAmount,
  perServing,
  validateRecipeDraft,
  type IngredientFields,
  type RecipeDraftError,
} from "@/lib/nutrition/recipe";
import { matchesSearch } from "@/lib/nutrition/search";

type Per100Food = {
  id: string;
  name_en: string | null;
  name_fa: string | null;
  kcal_100g: number;
  protein_100g: number;
  fat_100g: number;
  carbs_100g: number;
  fiber_100g: number;
};

type Row = {
  key: string;
  food_id: string | null;
  name_en: string | null;
  name_fa: string | null;
  grams: string;
  amount_en: string | null;
  amount_fa: string | null;
  is_staple: boolean;
};

const lines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const blank = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
};

export function RecipeEditor({
  foods,
  initial,
}: {
  foods: FoodRow[];
  initial: RecipeDetail | null;
}) {
  const { t, language } = useLanguage();
  const format = useFoodFormat();
  const router = useRouter();
  const id = useId();
  const nextKey = useRef(0);
  const recipe = initial?.recipe;

  const [titleEn, setTitleEn] = useState(recipe?.title_en ?? "");
  const [titleFa, setTitleFa] = useState(recipe?.title_fa ?? "");
  const [category, setCategory] = useState(recipe?.category ?? "main");
  const [servings, setServings] = useState(String(recipe?.servings ?? 2));
  const [stepsEn, setStepsEn] = useState((recipe?.steps_en ?? []).join("\n"));
  const [stepsFa, setStepsFa] = useState((recipe?.steps_fa ?? []).join("\n"));
  const [tipEn, setTipEn] = useState(recipe?.tip_en ?? "");
  const [tipFa, setTipFa] = useState(recipe?.tip_fa ?? "");
  const [tags, setTags] = useState<string[]>(recipe?.tags ?? []);
  const [rows, setRows] = useState<Row[]>(() =>
    (initial?.ingredients ?? []).map((item, index) => ({
      key: `initial-${index}`,
      food_id: item.food_id,
      name_en: item.name_en,
      name_fa: item.name_fa,
      grams: String(item.grams),
      amount_en: item.amount_en,
      amount_fa: item.amount_fa,
      is_staple: item.is_staple,
    })),
  );
  const [query, setQuery] = useState("");
  const [draftError, setDraftError] = useState<RecipeDraftError | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [busy, setBusy] = useState(false);

  // Foods already loaded with the recipe's ingredients cover any the list misses.
  const foodsById = useMemo(() => {
    const map = new Map<string, Per100Food>(foods.map((food) => [food.id, food]));
    for (const item of initial?.ingredients ?? [])
      if (item.food && !map.has(item.food.id)) map.set(item.food.id, item.food);
    return map;
  }, [foods, initial]);
  const results = query.trim()
    ? foods.filter((food) => matchesSearch(query, [food.name_en, food.name_fa])).slice(0, 8)
    : [];
  const servingsNumber = Number(servings);
  const ingredients: IngredientFields[] = rows.map((row) => ({
    food_id: row.food_id,
    name_en: blank(row.name_en),
    name_fa: blank(row.name_fa),
    // Food rows need real grams; an empty or unparsable field is an error, not 0 g.
    grams: row.grams.trim() === "" && !row.food_id ? 0 : parseAmount(row.grams),
    amount_en: blank(row.amount_en),
    amount_fa: blank(row.amount_fa),
    is_staple: row.is_staple,
  }));
  const live = perServing(
    ingredients.map((item) => ({
      grams: Number.isFinite(item.grams) ? item.grams : 0,
      food: per100(item.food_id ? foodsById.get(item.food_id) : null),
    })),
    Number.isFinite(servingsNumber) ? servingsNumber : 1,
  );
  // Own amounts are typed in the user's language; the other language is kept.
  const amountKey = language === "fa" ? "amount_fa" : "amount_en";
  const nameKey = language === "fa" ? "name_fa" : "name_en";

  function update(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function move(index: number, delta: -1 | 1) {
    setRows((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function newKey() {
    nextKey.current += 1;
    return `row-${nextKey.current}`;
  }

  function addFood(food: FoodRow) {
    if (rows.length >= MAX_INGREDIENTS) return;
    const key = newKey();
    setRows((current) => [
      ...current,
      {
        key,
        food_id: food.id,
        name_en: null,
        name_fa: null,
        grams: String(food.serving_grams ? Number(food.serving_grams) : 100),
        amount_en: null,
        amount_fa: null,
        is_staple: food.is_staple,
      },
    ]);
    setQuery("");
  }

  function addStaple() {
    if (rows.length >= MAX_INGREDIENTS) return;
    const key = newKey();
    setRows((current) => [
      ...current,
      {
        key,
        food_id: null,
        name_en: null,
        name_fa: null,
        grams: "0",
        amount_en: null,
        amount_fa: null,
        is_staple: true,
      },
    ]);
  }

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = {
      title_en: blank(titleEn),
      title_fa: blank(titleFa),
      servings: servingsNumber,
      steps_en: lines(stepsEn),
      steps_fa: lines(stepsFa),
      tags,
    };
    const problem = validateRecipeDraft(fields, ingredients);
    setDraftError(problem);
    if (problem) return;
    setBusy(true);
    setSaveError(false);
    try {
      const savedId = await saveRecipe(
        recipe?.id ?? null,
        {
          ...fields,
          category,
          tip_en: blank(tipEn),
          tip_fa: blank(tipFa),
          tags,
          suggested_side_food_id: recipe?.suggested_side_food_id ?? null,
          suggested_side_grams: recipe?.suggested_side_grams ?? null,
          copied_from: recipe?.copied_from ?? null,
        },
        ingredients,
      );
      // After an edit, Back should skip the editor.
      if (recipe) router.replace(`/food/recipes/${savedId}`);
      else router.push(`/food/recipes/${savedId}`);
    } catch {
      setSaveError(true);
      setBusy(false);
    }
  }

  const tagOptions = [...RECIPE_TAGS, ...tags.filter((tag) => isKnownTag(tag) && !RECIPE_TAGS.includes(tag as never))];

  return (
    <form className="space-y-5" onSubmit={submit} noValidate>
      <Card className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm" htmlFor={`${id}-title-en`}>
            {t("food.titleEn")}
            <Input id={`${id}-title-en`} dir="ltr" maxLength={160} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} invalid={draftError === "title"} />
          </label>
          <label className="grid gap-2 text-sm" htmlFor={`${id}-title-fa`}>
            {t("food.titleFa")}
            <Input id={`${id}-title-fa`} dir="rtl" maxLength={160} value={titleFa} onChange={(e) => setTitleFa(e.target.value)} invalid={draftError === "title"} />
          </label>
        </div>
        <p className="text-xs text-muted">{t("food.nameHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm" htmlFor={`${id}-category`}>
            {t("food.category")}
            <Select id={`${id}-category`} value={category} onChange={(e) => setCategory(e.target.value)}>
              {RECIPE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {format.category(value)}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-2 text-sm" htmlFor={`${id}-servings`}>
            {t("food.servings")}
            <Input
              id={`${id}-servings`}
              type="number"
              inputMode="numeric"
              min={MIN_SERVINGS}
              max={MAX_SERVINGS}
              step={1}
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              invalid={draftError === "servings"}
            />
          </label>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm">{t("food.filterTags")}</legend>
          <div className="flex flex-wrap gap-2">
            {tagOptions.map((tag) => (
              <button key={tag} type="button" className="chip-toggle" aria-pressed={tags.includes(tag)} onClick={() => toggleTag(tag)}>
                {format.tag(tag)}
              </button>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card className="space-y-4">
        <SectionHeading title={t("food.ingredients")} />
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{t("food.noIngredients")}</p>
        ) : (
          <ol className="space-y-3">
            {rows.map((row, index) => {
              const food = row.food_id ? foodsById.get(row.food_id) : undefined;
              const label = format.name(row.name_en ?? food?.name_en, row.name_fa ?? food?.name_fa);
              return (
                <li key={row.key} className="rounded-2xl border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    {row.food_id ? (
                      <p className="min-w-0 pt-2 font-medium">
                        <bdi>{label || t("food.removedFood")}</bdi>
                      </p>
                    ) : (
                      <label className="grid min-w-0 flex-1 gap-1 text-sm" htmlFor={`${id}-${row.key}-name`}>
                        {t(row.is_staple ? "food.stapleName" : "food.ingredientName")}
                        <Input
                          id={`${id}-${row.key}-name`}
                          size="sm"
                          dir="auto"
                          maxLength={160}
                          value={row[nameKey] ?? ""}
                          placeholder={(language === "fa" ? row.name_en : row.name_fa) ?? ""}
                          onChange={(e) => update(row.key, { [nameKey]: e.target.value })}
                          invalid={draftError === "ingredientName" && !label}
                        />
                      </label>
                    )}
                    <div className="flex shrink-0 items-center">
                      <button type="button" className="icon-button" aria-label={t("food.moveUp")} disabled={index === 0} onClick={() => move(index, -1)}>
                        <Icon name="up" size={18} />
                      </button>
                      <button type="button" className="icon-button" aria-label={t("food.moveDown")} disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
                        <Icon name="down" size={18} />
                      </button>
                      <button type="button" className="icon-button" aria-label={t("food.removeIngredient")} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>
                        <Icon name="trash" size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-2">
                    <label className="grid gap-1 text-xs text-muted" htmlFor={`${id}-${row.key}-grams`}>
                      {t("food.gramsField")}
                      <Input
                        id={`${id}-${row.key}-grams`}
                        size="sm"
                        inputMode="decimal"
                        dir="ltr"
                        aria-describedby={`${id}-grams-range`}
                        value={row.grams}
                        onChange={(e) => update(row.key, { grams: e.target.value })}
                        invalid={draftError === "grams"}
                      />
                    </label>
                    <label className="grid gap-1 text-xs text-muted" htmlFor={`${id}-${row.key}-amount`}>
                      {t("food.amountField")}
                      <Input
                        id={`${id}-${row.key}-amount`}
                        size="sm"
                        maxLength={80}
                        placeholder={t("food.amountPlaceholder")}
                        value={row[amountKey] ?? ""}
                        onChange={(e) => update(row.key, { [amountKey]: e.target.value })}
                      />
                    </label>
                  </div>
                  <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted" htmlFor={`${id}-${row.key}-staple`}>
                    <input
                      id={`${id}-${row.key}-staple`}
                      type="checkbox"
                      checked={row.is_staple}
                      onChange={(e) => update(row.key, { is_staple: e.target.checked })}
                    />
                    {t("food.stapleToggle")}
                  </label>
                </li>
              );
            })}
          </ol>
        )}
        <p id={`${id}-grams-range`} className="sr-only">{t("food.draftError.grams")}</p>
        {rows.length >= MAX_INGREDIENTS && (
          <p className="text-sm text-muted">{t("food.draftError.ingredients")}</p>
        )}
        <div className="space-y-2">
          <label className="grid gap-2 text-sm" htmlFor={`${id}-food-search`}>
            {t("food.addIngredient")}
            <Input
              id={`${id}-food-search`}
              type="search"
              value={query}
              placeholder={t("food.searchFoods")}
              onChange={(e) => setQuery(e.target.value)}
              disabled={rows.length >= MAX_INGREDIENTS}
            />
          </label>
          {results.length > 0 && (
            <ul className="divide-y divide-border rounded-2xl border border-border" aria-label={t("food.searchResults")}>
              {results.map((food) => (
                <li key={food.id}>
                  <button type="button" className="food-row" onClick={() => addFood(food)}>
                    <span className="min-w-0 truncate">
                      <bdi>{format.name(food.name_en, food.name_fa)}</bdi>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                      <bdi>{format.kcal(Number(food.kcal_100g))}</bdi>
                      <Icon name="plus" size={16} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim() !== "" && results.length === 0 && (
            <p className="text-sm text-muted">{t("food.noMatches")}</p>
          )}
          <Button variant="ghost" size="sm" onClick={addStaple} disabled={rows.length >= MAX_INGREDIENTS}>
            <Icon name="plus" size={16} />
            {t("food.addStaple")}
          </Button>
        </div>
        <div className="space-y-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">{t("food.livePerServing")}</h3>
          <NutritionGrid value={live} />
        </div>
      </Card>

      <Card className="space-y-4">
        <SectionHeading title={t("food.steps")} description={t("food.stepsHint")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm" htmlFor={`${id}-steps-en`}>
            {t("food.stepsEn")}
            <Textarea id={`${id}-steps-en`} dir="ltr" rows={6} value={stepsEn} onChange={(e) => setStepsEn(e.target.value)} invalid={draftError === "steps"} />
          </label>
          <label className="grid gap-2 text-sm" htmlFor={`${id}-steps-fa`}>
            {t("food.stepsFa")}
            <Textarea id={`${id}-steps-fa`} dir="rtl" rows={6} value={stepsFa} onChange={(e) => setStepsFa(e.target.value)} invalid={draftError === "steps"} />
          </label>
          <label className="grid gap-2 text-sm" htmlFor={`${id}-tip-en`}>
            {t("food.tipEn")}
            <Textarea id={`${id}-tip-en`} dir="ltr" rows={2} maxLength={600} value={tipEn} onChange={(e) => setTipEn(e.target.value)} />
          </label>
          <label className="grid gap-2 text-sm" htmlFor={`${id}-tip-fa`}>
            {t("food.tipFa")}
            <Textarea id={`${id}-tip-fa`} dir="rtl" rows={2} maxLength={600} value={tipFa} onChange={(e) => setTipFa(e.target.value)} />
          </label>
        </div>
      </Card>

      {draftError && <ErrorNotice>{t(`food.draftError.${draftError}` as TranslationKey)}</ErrorNotice>}
      {saveError && <ErrorNotice>{t("food.actionError")}</ErrorNotice>}
      <div className="flex flex-wrap justify-end gap-2">
        <Link href={recipe ? `/food/recipes/${recipe.id}` : "/food"} className="btn btn-ghost btn-md">
          {t("common.cancel")}
        </Link>
        <Button type="submit" variant="primary" busy={busy}>
          {busy ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
