"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button, EmptyState, ErrorNotice, Input, Pill, SegmentedControl, Select } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { per100, useFoodFormat } from "@/components/food/shared";
import { loadFoodHub, type FoodRow, type RecipeSummary } from "@/lib/db/food";
import type { FoodLogEntry } from "@/lib/db/foodLog";
import { foodNutrition, type Nutrition } from "@/lib/nutrition/food";
import {
  MAX_LOG_GRAMS,
  MEAL_SLOTS,
  PORTION_OPTIONS,
  defaultSlot,
  entryFromFood,
  entryFromQuick,
  entryFromRecent,
  entryFromRecipe,
  isMealSlot,
  recentItems,
  validateQuick,
  type LogDraft,
  type MealSlot,
  type QuickError,
} from "@/lib/nutrition/log";
import { localizedName, parseAmount, perServing } from "@/lib/nutrition/recipe";
import { matchesSearch } from "@/lib/nutrition/search";

export type FoodCatalog = { foods: FoodRow[]; recipes: RecipeSummary[] };
type Tab = "recent" | "search" | "quick";
type Picked =
  | { kind: "food"; food: FoodRow }
  | { kind: "recipe"; recipe: RecipeSummary; perServing: Nutrition };

const RESULTS = 30;

/**
 * Quick add: Recent (last 20 distinct items, one tap), Search (catalog, own
 * foods and recipes; a serving or grams, or portions) and Quick calories.
 * Without a catalog prop (Today) the catalog loads when the sheet opens.
 */
export function QuickAddSheet({
  open,
  onClose,
  catalog,
  recent,
  busy,
  error,
  initialSlot,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  catalog: FoodCatalog | null;
  recent: FoodLogEntry[];
  busy: boolean;
  error: boolean;
  /** Preselected meal; the time of day decides without it. */
  initialSlot?: MealSlot | null;
  onAdd: (draft: LogDraft) => Promise<boolean>;
}) {
  const { t } = useLanguage();
  return (
    <Sheet open={open} onClose={onClose} busy={busy} title={t("foodLog.sheetTitle")}>
      {open && (
        <QuickAddBody
          catalog={catalog}
          recent={recent}
          busy={busy}
          error={error}
          initialSlot={initialSlot ?? null}
          onAdd={onAdd}
        />
      )}
    </Sheet>
  );
}

function QuickAddBody({
  catalog: givenCatalog,
  recent,
  busy,
  error,
  initialSlot,
  onAdd,
}: {
  catalog: FoodCatalog | null;
  recent: FoodLogEntry[];
  busy: boolean;
  error: boolean;
  initialSlot: MealSlot | null;
  onAdd: (draft: LogDraft) => Promise<boolean>;
}) {
  const { t } = useLanguage();
  const format = useFoodFormat();
  const id = useId();
  const recentList = useMemo(() => recentItems(recent), [recent]);
  const [tab, setTab] = useState<Tab>(recentList.length > 0 ? "recent" : "search");
  const [slot, setSlot] = useState<MealSlot>(
    () => initialSlot ?? defaultSlot(new Date().getHours()),
  );
  const [loaded, setLoaded] = useState<FoodCatalog | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const catalog = givenCatalog ?? loaded;

  useEffect(() => {
    if (givenCatalog) return;
    let cancelled = false;
    loadFoodHub()
      .then((data) => {
        if (!cancelled) setLoaded(data);
      })
      .catch(() => {
        if (!cancelled) setCatalogFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [givenCatalog]);

  const preview = (value: { kcal: number; protein: number }) =>
    `${format.kcal(value.kcal)} · ${format.protein(value.protein)}`;

  return (
    <div className="space-y-4">
      {error && <ErrorNotice>{t("common.error")}</ErrorNotice>}
      <label className="grid gap-2 text-sm" htmlFor={`${id}-slot`}>
        {t("foodLog.slot")}
        <Select
          id={`${id}-slot`}
          value={slot}
          onChange={(event) => {
            if (isMealSlot(event.target.value)) setSlot(event.target.value);
          }}
        >
          {MEAL_SLOTS.map((value) => (
            <option key={value} value={value}>
              {t(`foodLog.slot.${value}`)}
            </option>
          ))}
        </Select>
      </label>
      <SegmentedControl
        label={t("foodLog.tabs")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "recent", label: t("foodLog.tab.recent") },
          { value: "search", label: t("foodLog.tab.search") },
          { value: "quick", label: t("foodLog.tab.quick") },
        ]}
      />
      {tab === "recent" &&
        (recentList.length === 0 ? (
          <EmptyState>{t("foodLog.recentEmpty")}</EmptyState>
        ) : (
          <ul className="grid gap-2">
            {recentList.map((item) => (
              <li key={item.id} className="list-row">
                <div className="min-w-0 flex-1">
                  <p className="row-title">
                    <bdi>{item.label}</bdi>
                  </p>
                  <p className="row-detail">
                    <bdi>{preview({ kcal: Number(item.kcal), protein: Number(item.protein) })}</bdi>
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={busy}
                  aria-label={`${t("foodLog.addEntry")}: ${item.label}`}
                  onClick={() =>
                    void onAdd(
                      entryFromRecent(
                        {
                          ...item,
                          source: item.source as LogDraft["source"],
                          kcal: Number(item.kcal),
                          protein: Number(item.protein),
                          fat: Number(item.fat),
                          carbs: Number(item.carbs),
                          portions: item.portions === null ? null : Number(item.portions),
                          grams: item.grams === null ? null : Number(item.grams),
                        },
                        slot,
                      ),
                    )
                  }
                >
                  {t("foodLog.addEntry")}
                </Button>
              </li>
            ))}
          </ul>
        ))}
      {tab === "search" &&
        (catalog ? (
          <SearchTab catalog={catalog} slot={slot} busy={busy} onAdd={onAdd} preview={preview} />
        ) : catalogFailed ? (
          <ErrorNotice>{t("food.loadError")}</ErrorNotice>
        ) : (
          <p className="text-sm text-muted">{t("foodLog.catalogLoading")}</p>
        ))}
      {tab === "quick" && <QuickTab slot={slot} busy={busy} onAdd={onAdd} />}
    </div>
  );
}

function SearchTab({
  catalog,
  slot,
  busy,
  onAdd,
  preview,
}: {
  catalog: FoodCatalog;
  slot: MealSlot;
  busy: boolean;
  onAdd: (draft: LogDraft) => Promise<boolean>;
  preview: (value: { kcal: number; protein: number }) => string;
}) {
  const { t, number, language } = useLanguage();
  const format = useFoodFormat();
  const id = useId();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [grams, setGrams] = useState("");
  const [portions, setPortions] = useState("1");
  const [gramsError, setGramsError] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const recipes = catalog.recipes
      .filter((recipe) => matchesSearch(query, [recipe.title_en, recipe.title_fa]))
      .map((recipe) => ({ kind: "recipe" as const, recipe }));
    const foods = catalog.foods
      .filter((food) => matchesSearch(query, [food.name_en, food.name_fa]))
      .map((food) => ({ kind: "food" as const, food }));
    // Own items first: they are what the user cooks and eats most.
    return [...recipes, ...foods]
      .sort((a, b) => {
        const ownA = (a.kind === "recipe" ? a.recipe.owner_id : a.food.owner_id) ? 0 : 1;
        const ownB = (b.kind === "recipe" ? b.recipe.owner_id : b.food.owner_id) ? 0 : 1;
        return ownA - ownB;
      })
      .slice(0, RESULTS);
  }, [catalog, query]);

  if (picked) {
    const name =
      picked.kind === "food"
        ? localizedName(language, picked.food.name_en, picked.food.name_fa)
        : localizedName(language, picked.recipe.title_en, picked.recipe.title_fa);
    const gramsValue = parseAmount(grams);
    const portionValue = Number(portions);
    const values =
      picked.kind === "food"
        ? foodNutrition(per100(picked.food) ?? { kcal: 0, protein: 0, fat: 0, carbs: 0 }, Number.isFinite(gramsValue) ? gramsValue : 0)
        : {
            kcal: picked.perServing.kcal * portionValue,
            protein: picked.perServing.protein * portionValue,
          };
    const serving = picked.kind === "food" ? picked.food.serving_grams : null;

    async function add() {
      if (!picked) return;
      let draft: LogDraft;
      if (picked.kind === "food") {
        if (!Number.isFinite(gramsValue) || gramsValue <= 0 || gramsValue > MAX_LOG_GRAMS) {
          setGramsError(true);
          return;
        }
        const values100 = per100(picked.food);
        if (!values100) return;
        draft = entryFromFood({ id: picked.food.id, per100: values100 }, gramsValue, name, slot);
      } else {
        draft = entryFromRecipe(
          { id: picked.recipe.id, perServing: picked.perServing },
          portionValue,
          name,
          slot,
        );
      }
      if (await onAdd(draft)) setPicked(null);
    }

    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-foreground">
            <bdi>{name}</bdi>
          </p>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPicked(null)}>
            {t("common.back")}
          </Button>
        </div>
        {picked.kind === "food" ? (
          <>
            {serving !== null && (
              <Button
                size="sm"
                onClick={() => {
                  setGrams(String(Number(serving)));
                  setGramsError(false);
                }}
              >
                {t("foodLog.useServing", { value: number(Number(serving)) })}
              </Button>
            )}
            <label className="grid gap-2 text-sm" htmlFor={`${id}-grams`}>
              {t("foodLog.grams")}
              <Input
                id={`${id}-grams`}
                inputMode="decimal"
                value={grams}
                invalid={gramsError}
                onChange={(event) => {
                  setGrams(event.target.value);
                  setGramsError(false);
                }}
              />
            </label>
            {gramsError && <ErrorNotice>{t("foodLog.error.grams")}</ErrorNotice>}
          </>
        ) : (
          <SegmentedControl
            label={t("foodLog.portions")}
            value={portions}
            onChange={setPortions}
            options={PORTION_OPTIONS.map((value) => ({
              value: String(value),
              label: number(value),
            }))}
          />
        )}
        <p className="text-sm text-muted">
          <bdi>{preview(values)}</bdi>
        </p>
        <Button
          variant="primary"
          busy={busy}
          disabled={busy || (picked.kind === "food" && !per100(picked.food))}
          onClick={() => void add()}
        >
          {t("foodLog.addEntry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("foodLog.searchLabel")}
        aria-label={t("foodLog.searchLabel")}
      />
      {!query.trim() ? (
        <p className="text-sm text-muted">{t("foodLog.searchHint")}</p>
      ) : results.length === 0 ? (
        <EmptyState>{t("foodLog.searchEmpty")}</EmptyState>
      ) : (
        <ul className="grid gap-2">
          {results.map((result) => {
            if (result.kind === "recipe") {
              const recipe = result.recipe;
              const value = perServing(
                recipe.ingredients.map((item) => ({ grams: Number(item.grams), food: per100(item.food) })),
                recipe.servings,
              );
              return (
                <li key={`r-${recipe.id}`}>
                  <button
                    type="button"
                    className="list-row w-full text-start"
                    onClick={() => {
                      setPortions("1");
                      setPicked({ kind: "recipe", recipe, perServing: value });
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="row-title">
                        <bdi>{format.name(recipe.title_en, recipe.title_fa)}</bdi>
                      </p>
                      <p className="row-detail">
                        <bdi>{preview(value)}</bdi> {t("food.perServing")}
                      </p>
                    </div>
                    <Pill muted>{t("foodLog.recipeBadge")}</Pill>
                  </button>
                </li>
              );
            }
            const food = result.food;
            const values100 = per100(food);
            return (
              <li key={`f-${food.id}`}>
                <button
                  type="button"
                  className="list-row w-full text-start"
                  onClick={() => {
                    setGrams(String(food.serving_grams === null ? 100 : Number(food.serving_grams)));
                    setGramsError(false);
                    setPicked({ kind: "food", food });
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="row-title">
                      <bdi>{format.name(food.name_en, food.name_fa)}</bdi>
                    </p>
                    {values100 && (
                      <p className="row-detail">
                        <bdi>{preview(values100)}</bdi> {t("foodLog.per100")}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function QuickTab({
  slot,
  busy,
  onAdd,
}: {
  slot: MealSlot;
  busy: boolean;
  onAdd: (draft: LogDraft) => Promise<boolean>;
}) {
  const { t } = useLanguage();
  const id = useId();
  const [label, setLabel] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [formError, setFormError] = useState<QuickError | null>(null);

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const values = {
          label,
          kcal: parseAmount(kcal),
          protein: protein.trim() ? parseAmount(protein) : null,
        };
        const problem = validateQuick(values);
        setFormError(problem);
        if (problem) return;
        if (await onAdd(entryFromQuick(values, slot))) {
          setLabel("");
          setKcal("");
          setProtein("");
        }
      }}
    >
      <label className="grid gap-2 text-sm" htmlFor={`${id}-label`}>
        {t("foodLog.label")}
        <Input
          id={`${id}-label`}
          value={label}
          maxLength={200}
          invalid={formError === "label"}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm" htmlFor={`${id}-kcal`}>
          {t("foodLog.kcal")}
          <Input
            id={`${id}-kcal`}
            inputMode="numeric"
            value={kcal}
            invalid={formError === "kcal"}
            onChange={(event) => setKcal(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm" htmlFor={`${id}-protein`}>
          {t("foodLog.protein")}
          <Input
            id={`${id}-protein`}
            inputMode="decimal"
            value={protein}
            invalid={formError === "protein"}
            onChange={(event) => setProtein(event.target.value)}
          />
        </label>
      </div>
      {formError && <ErrorNotice>{t(`foodLog.error.${formError}`)}</ErrorNotice>}
      <Button type="submit" variant="primary" busy={busy} disabled={busy}>
        {t("foodLog.addEntry")}
      </Button>
    </form>
  );
}
