"use client";

import { useMemo, useRef, useState } from "react";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Input,
  PageHeader,
  PageShell,
  Pill,
  SectionHeading,
  SegmentedControl,
  Select,
} from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { useOwnedData } from "@/components/life/useOwnedData";
import { FoodForm } from "@/components/food/FoodForm";
import { LogTab } from "@/components/food/LogTab";
import type { FoodDay } from "@/lib/db/foodLog";
import { GroceriesTab } from "@/components/food/GroceriesTab";
import { PlanTab, type PlanLookup } from "@/components/food/PlanTab";
import {
  ConfirmDelete,
  NutritionGrid,
  TagChips,
  isKnownTag,
  per100,
  useFoodFormat,
} from "@/components/food/shared";
import {
  deleteFood,
  loadFoodHub,
  saveFood,
  type FoodHubData,
  type FoodRow,
  type RecipeSummary,
} from "@/lib/db/food";
import { loadPlanEntries, type PlanEntry, type PlanTargets } from "@/lib/db/mealPlan";
import { startOfWeek } from "@/lib/nutrition/plan";
import { foodNutrition } from "@/lib/nutrition/food";
import { RECIPE_CATEGORIES, perServing } from "@/lib/nutrition/recipe";
import { matchesSearch } from "@/lib/nutrition/search";

export type FoodTab = "plan" | "recipes" | "groceries" | "foods" | "log";
const PAGE = 60;
// The hub shows everything visible to the user; RLS does the scoping.
const reloadFoodHub = () => loadFoodHub();

export function FoodClient({
  userId,
  initialTab,
  initialData,
  initialLoadError,
  serverDay,
  explicitDay,
  initialFoodDay,
  today,
  weekStartsOn,
  initialWeekStart,
  initialEntries,
  targets,
  planLoadError,
}: {
  userId: string;
  initialTab: FoodTab;
  initialData: FoodHubData;
  initialLoadError: boolean;
  serverDay: string;
  explicitDay: boolean;
  initialFoodDay: FoodDay | null;
  today: string;
  weekStartsOn: number;
  initialWeekStart: string;
  initialEntries: PlanEntry[];
  targets: PlanTargets;
  planLoadError: boolean;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const { data, error, busy, act } = useOwnedData(
    reloadFoodHub,
    userId,
    initialData,
    initialLoadError,
  );
  const [tab, setTab] = useState<FoodTab>(initialTab);
  const currentWeekStart = startOfWeek(today, weekStartsOn);
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [entries, setEntries] = useState(initialEntries);
  const [planError, setPlanError] = useState(planLoadError);
  const [planBusy, setPlanBusy] = useState(false);
  // Only the latest plan request may update state (quick week changes).
  const planRequest = useRef(0);

  const lookup = useMemo<PlanLookup>(
    () => ({
      recipes: new Map(
        data.recipes.map((recipe) => [
          recipe.id,
          {
            title_en: recipe.title_en,
            title_fa: recipe.title_fa,
            servings: recipe.servings,
            ingredients: recipe.ingredients.map((item) => ({
              grams: Number(item.grams),
              food: per100(item.food),
            })),
          },
        ]),
      ),
      foods: new Map(
        data.foods.flatMap((food) => {
          const values = per100(food);
          return values
            ? [
                [
                  food.id,
                  {
                    name_en: food.name_en,
                    name_fa: food.name_fa,
                    per100: values,
                    serving_grams: food.serving_grams === null ? null : Number(food.serving_grams),
                  },
                ] as const,
              ]
            : [];
        }),
      ),
    }),
    [data],
  );

  function url(nextTab: FoodTab, nextWeek: string) {
    const params = new URLSearchParams();
    if (nextTab !== "recipes") params.set("tab", nextTab);
    if ((nextTab === "plan" || nextTab === "groceries") && nextWeek !== currentWeekStart) {
      params.set("week", nextWeek);
    }
    const query = params.toString();
    return query ? `/food?${query}` : "/food";
  }

  function changeTab(next: FoodTab) {
    setTab(next);
    // Keep the tab in the URL so back/forward and reloads land on it.
    router.replace(url(next, weekStart), { scroll: false });
  }

  async function reloadPlan(nextWeek = weekStart) {
    const request = ++planRequest.current;
    setPlanBusy(true);
    try {
      const value = await loadPlanEntries(nextWeek);
      if (request !== planRequest.current) return;
      setEntries(value);
      setPlanError(false);
    } catch {
      if (request === planRequest.current) setPlanError(true);
    } finally {
      if (request === planRequest.current) setPlanBusy(false);
    }
  }

  function changeWeek(next: string) {
    setWeekStart(next);
    router.replace(url(tab, next), { scroll: false });
    void reloadPlan(next);
  }

  return (
    <PageShell>
      <PageHeader
        title={t("food.title")}
        description={t("food.description")}
        actions={
          tab === "recipes" ? (
            <Link href="/food/recipes/new" className="btn btn-primary btn-md">
              <Icon name="plus" size={18} />
              {t("food.newRecipe")}
            </Link>
          ) : undefined
        }
      />
      <div className="food-tabs mb-5">
        <SegmentedControl
          label={t("food.tabs")}
          value={tab}
          onChange={changeTab}
          options={[
            { value: "plan", label: t("food.tab.plan") },
            { value: "recipes", label: t("food.tab.recipes") },
            { value: "groceries", label: t("food.tab.groceries") },
            { value: "foods", label: t("food.tab.foods") },
            { value: "log", label: t("food.tab.log") },
          ]}
        />
      </div>
      {error && <ErrorNotice className="mb-5">{t("food.loadError")}</ErrorNotice>}
      {planError && tab === "plan" && (
        <ErrorNotice className="mb-5">{t("food.plan.loadError")}</ErrorNotice>
      )}
      {tab === "plan" ? (
        <PlanTab
          key={weekStart}
          userId={userId}
          weekStart={weekStart}
          currentWeekStart={currentWeekStart}
          today={today}
          entries={entries}
          lookup={lookup}
          targets={targets}
          busy={planBusy}
          onChangeWeek={changeWeek}
          onChanged={() => reloadPlan()}
          onOpenGroceries={() => changeTab("groceries")}
        />
      ) : tab === "groceries" ? (
        <GroceriesTab
          key={weekStart}
          userId={userId}
          weekStart={weekStart}
          currentWeekStart={currentWeekStart}
          onChangeWeek={changeWeek}
          onOpenPlan={() => changeTab("plan")}
        />
      ) : tab === "log" ? (
        <LogTab
          userId={userId}
          serverDay={serverDay}
          explicitDay={explicitDay}
          initialDay={initialFoodDay}
          catalog={data}
        />
      ) : tab === "recipes" ? (
        <RecipesTab recipes={data.recipes} />
      ) : (
        <FoodsTab
          userId={userId}
          foods={data.foods}
          busy={busy}
          act={act}
        />
      )}
    </PageShell>
  );
}

function RecipesTab({ recipes }: { recipes: RecipeSummary[] }) {
  const { t } = useLanguage();
  const format = useFoodFormat();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const tagOptions = useMemo(
    () => [...new Set(recipes.flatMap((recipe) => recipe.tags).filter(isKnownTag))].sort(),
    [recipes],
  );
  const visible = recipes.filter(
    (recipe) =>
      (!category || recipe.category === category) &&
      tags.every((tag) => recipe.tags.includes(tag)) &&
      matchesSearch(query, [recipe.title_en, recipe.title_fa]),
  );
  const mine = visible.filter((recipe) => recipe.owner_id);
  const starters = visible.filter((recipe) => !recipe.owner_id);

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  function list(items: RecipeSummary[]) {
    return (
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((recipe) => {
          const value = perServing(
            recipe.ingredients.map((item) => ({ grams: Number(item.grams), food: per100(item.food) })),
            recipe.servings,
          );
          return (
            <li key={recipe.id}>
              <Link href={`/food/recipes/${recipe.id}`} className="card food-card block h-full">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-foreground">
                    <bdi>{format.name(recipe.title_en, recipe.title_fa)}</bdi>
                  </h3>
                  <Pill muted>{format.category(recipe.category)}</Pill>
                </div>
                <p className="mt-2 text-sm text-muted">
                  <bdi>{format.kcal(value.kcal)}</bdi> · <bdi>{format.protein(value.protein)}</bdi>{" "}
                  {t("food.perServing")}
                </p>
                <div className="mt-3">
                  <TagChips tags={recipe.tags} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("food.searchRecipes")}
          aria-label={t("food.searchRecipes")}
        />
        <Select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label={t("food.filterCategory")}
        >
          <option value="">{t("food.allCategories")}</option>
          {RECIPE_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {format.category(value)}
            </option>
          ))}
        </Select>
      </div>
      {tagOptions.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("food.filterTags")}>
          {tagOptions.map((tag) => (
            <button
              key={tag}
              type="button"
              className="chip-toggle"
              aria-pressed={tags.includes(tag)}
              onClick={() => toggleTag(tag)}
            >
              {format.tag(tag)}
            </button>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <EmptyState title={t("food.noMatchesTitle")}>{t("food.noMatches")}</EmptyState>
      ) : (
        <>
          {mine.length > 0 && (
            <section className="space-y-3">
              <SectionHeading title={t("food.myRecipes")} />
              {list(mine)}
            </section>
          )}
          {starters.length > 0 && (
            <section className="space-y-3">
              <SectionHeading
                title={t("food.starterRecipes")}
                description={t("food.starterDescription")}
              />
              {list(starters)}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function FoodsTab({
  userId,
  foods,
  busy: refreshing,
  act,
}: {
  userId: string;
  foods: FoodRow[];
  busy: boolean;
  act: (action: () => Promise<void>) => Promise<boolean>;
}) {
  const { t, locale } = useLanguage();
  const [pending, setPending] = useState(false);
  const busy = pending || refreshing;
  const format = useFoodFormat();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "ingredient" | "dish">("all");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<FoodRow | null>(null);
  const [editor, setEditor] = useState<FoodRow | "new" | null>(null);
  const [actionError, setActionError] = useState(false);

  const visible = foods.filter(
    (food) =>
      (kind === "all" || food.kind === kind) &&
      matchesSearch(query, [food.name_en, food.name_fa]),
  );
  // Own foods first, then the catalog, each in name order for the user's language.
  const sorted = [...visible].sort(
    (a, b) =>
      Number(!a.owner_id) - Number(!b.owner_id) ||
      format.name(a.name_en, a.name_fa).localeCompare(format.name(b.name_en, b.name_fa), locale),
  );

  // The action and the refresh after it are reported separately: a saved food
  // must never look unsaved (a retry would duplicate it) because a reload failed.
  async function run(action: () => Promise<void>, after: () => void) {
    if (busy) return;
    setActionError(false);
    setPending(true);
    try {
      await action();
    } catch {
      setActionError(true);
      return;
    } finally {
      setPending(false);
    }
    after();
    await act(async () => {}); // a failed reload shows the page's load notice
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          className="min-w-0 flex-1 basis-60"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setShown(PAGE);
          }}
          placeholder={t("food.searchFoods")}
          aria-label={t("food.searchFoods")}
        />
        <Button variant="primary" onClick={() => setEditor("new")}>
          <Icon name="plus" size={18} />
          {t("food.addFood")}
        </Button>
      </div>
      <SegmentedControl
        label={t("food.kind")}
        value={kind}
        onChange={(value) => {
          setKind(value);
          setShown(PAGE);
        }}
        options={[
          { value: "all", label: t("food.kind.all") },
          { value: "ingredient", label: t("food.kind.ingredient") },
          { value: "dish", label: t("food.kind.dish") },
        ]}
      />
      {sorted.length === 0 ? (
        <EmptyState title={t("food.noMatchesTitle")}>{t("food.noMatches")}</EmptyState>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {sorted.slice(0, shown).map((food) => (
              <li key={food.id}>
                <button
                  type="button"
                  className="food-row"
                  onClick={() => setSelected(food)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                      <bdi>{format.name(food.name_en, food.name_fa)}</bdi>
                    </span>
                    <span className="block text-xs text-muted">
                      {t(food.kind === "dish" ? "food.kindSingle.dish" : "food.kindSingle.ingredient")}
                      {food.owner_id && <> · {t("food.mine")}</>}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted">
                    <bdi>{format.kcal(Number(food.kcal_100g))}</bdi>
                    <span className="sr-only"> {t("food.per100")}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {sorted.length > shown && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => setShown((count) => count + PAGE)}>
            {t("food.showMore")}
          </Button>
        </div>
      )}
      <p className="text-xs text-muted">{t("food.approxNote")}</p>

      <Sheet
        open={selected !== null}
        onClose={() => {
          setSelected(null);
          setActionError(false);
        }}
        title={selected ? format.name(selected.name_en, selected.name_fa) : t("food.tab.foods")}
        description={selected?.owner_id ? t("food.mineNote") : t("food.catalogNote")}
        busy={busy}
      >
        {selected && (
          <FoodDetail
            food={selected}
            busy={busy}
            error={actionError}
            onEdit={() => {
              setEditor(selected);
              setSelected(null);
            }}
            onDelete={() =>
              void run(() => deleteFood(userId, selected.id), () => setSelected(null))
            }
          />
        )}
      </Sheet>
      <Sheet
        open={editor !== null}
        onClose={() => {
          setEditor(null);
          setActionError(false);
        }}
        title={editor === "new" ? t("food.addFood") : t("food.editFood")}
        busy={busy}
      >
        {editor !== null && (
          <FoodForm
            initial={editor === "new" ? null : editor}
            busy={busy}
            error={actionError}
            onCancel={() => setEditor(null)}
            onSave={(values) =>
              void run(
                () => saveFood(userId, values, editor === "new" ? undefined : editor.id),
                () => setEditor(null),
              )
            }
          />
        )}
      </Sheet>
    </div>
  );
}

function FoodDetail({
  food,
  busy,
  error,
  onEdit,
  onDelete,
}: {
  food: FoodRow;
  busy: boolean;
  error: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t, number } = useLanguage();
  const format = useFoodFormat();
  const values = per100(food);
  const servingGrams = food.serving_grams ? Number(food.serving_grams) : null;
  const servingLabel = format.name(food.serving_label_en, food.serving_label_fa);
  if (!values) return null;
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("food.per100")}</h3>
        <NutritionGrid value={{ ...values, fiber: values.fiber ?? 0 }} />
      </section>
      {servingGrams && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            {t("food.perServingOf", { grams: number(servingGrams) })}
            {servingLabel && (
              <span className="font-normal text-muted">
                {" "}
                · <bdi>{servingLabel}</bdi>
              </span>
            )}
          </h3>
          <NutritionGrid value={foodNutrition(values, servingGrams)} />
        </section>
      )}
      <TagChips tags={food.tags} />
      {error && <ErrorNotice>{t("food.actionError")}</ErrorNotice>}
      {food.owner_id && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onEdit} disabled={busy}>
            <Icon name="edit" size={16} />
            {t("common.edit")}
          </Button>
          <ConfirmDelete
            label={t("food.deleteFood")}
            question={t("food.confirmDeleteFood")}
            busy={busy}
            onConfirm={onDelete}
          />
        </div>
      )}
    </div>
  );
}
