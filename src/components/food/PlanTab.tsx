"use client";

import { useMemo, useState } from "react";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import {
  Button,
  Card,
  ErrorNotice,
  Input,
  SegmentedControl,
  Select,
} from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { ConfirmDelete, useFoodFormat } from "@/components/food/shared";
import type { TranslationKey } from "@/lib/i18n";
import {
  addPlanEntry,
  clearWeek,
  copyLastWeek,
  deletePlanEntry,
  updatePlanEntry,
  type PlanEntry,
  type PlanTargets,
} from "@/lib/db/mealPlan";
import { matchesSearch } from "@/lib/nutrition/search";
import type { Nutrition } from "@/lib/nutrition/food";
import {
  MEAL_SLOTS,
  PORTION_CHOICES,
  addDays,
  clampPortions,
  dayTotals,
  entryNutrition,
  nextPosition,
  weekAverage,
  weekDays,
  weekdayOf,
  type MealSlot,
  type PlanFood,
  type PlanRecipe,
} from "@/lib/nutrition/plan";
import { clampServings } from "@/lib/nutrition/recipe";

export type PlanLookup = {
  recipes: Map<string, PlanRecipe & { title_en: string | null; title_fa: string | null }>;
  foods: Map<string, PlanFood & { name_en: string | null; name_fa: string | null }>;
};

type Editor =
  | { mode: "add"; day: string; slot: MealSlot }
  | { mode: "edit"; entry: PlanEntry };

const RESULTS = 20;

export function PlanTab({
  userId,
  weekStart,
  currentWeekStart,
  today,
  entries,
  lookup,
  targets,
  busy: loading,
  onChangeWeek,
  onChanged,
  onOpenGroceries,
}: {
  userId: string;
  weekStart: string;
  currentWeekStart: string;
  today: string;
  entries: PlanEntry[];
  lookup: PlanLookup;
  targets: PlanTargets;
  busy: boolean;
  onChangeWeek: (weekStart: string) => void;
  onChanged: () => Promise<void>;
  onOpenGroceries: () => void;
}) {
  const { t, date, weekday, number } = useLanguage();
  const format = useFoodFormat();
  const days = weekDays(weekStart);
  const [selected, setSelected] = useState(days.includes(today) ? today : weekStart);
  const selectedDay = days.includes(selected) ? selected : weekStart;
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = pending || loading;

  const week = entries.filter((entry) => entry.plan_date >= weekStart);
  const previous = entries.filter((entry) => entry.plan_date < weekStart);
  const average = weekAverage(week, weekStart, lookup.recipes, lookup.foods);

  async function run(action: () => Promise<void>, after?: () => void) {
    if (busy) return;
    setError(false);
    setNotice(null);
    setPending(true);
    try {
      await action();
    } catch {
      setError(true);
      setPending(false);
      return;
    }
    after?.();
    await onChanged();
    setPending(false);
  }

  function name(entry: Pick<PlanEntry, "recipe_id" | "food_id">) {
    if (entry.recipe_id) {
      const recipe = lookup.recipes.get(entry.recipe_id);
      return recipe ? format.name(recipe.title_en, recipe.title_fa) : t("food.plan.missing");
    }
    const food = entry.food_id ? lookup.foods.get(entry.food_id) : null;
    return food ? format.name(food.name_en, food.name_fa) : t("food.plan.missing");
  }

  function totalLine(value: Nutrition) {
    const kcal = format.kcal(value.kcal);
    const protein = format.protein(value.protein);
    if (!targets) return `${kcal} · ${protein}`;
    const kcalText =
      targets.kcal === null
        ? kcal
        : t("food.plan.ofTarget", { value: kcal, target: format.kcal(targets.kcal) });
    const proteinText = t("food.plan.ofTarget", {
      value: protein,
      target:
        format.protein(targets.protein) +
        (targets.proteinMode === "limit" ? ` (${t("food.plan.limit")})` : ""),
    });
    return `${kcalText} · ${proteinText}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            aria-label={t("food.plan.prevWeek")}
            disabled={busy}
            onClick={() => onChangeWeek(addDays(weekStart, -7))}
          >
            <Icon name="chevron" size={16} className="rotate-180 rtl:rotate-0" />
          </Button>
          <h2 className="font-semibold">
            <bdi>{t("food.plan.week", { date: date(weekStart) })}</bdi>
          </h2>
          <Button
            size="sm"
            variant="ghost"
            aria-label={t("food.plan.nextWeek")}
            disabled={busy}
            onClick={() => onChangeWeek(addDays(weekStart, 7))}
          >
            <Icon name="chevron" size={16} className="rtl:rotate-180" />
          </Button>
          {weekStart !== currentWeekStart && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onChangeWeek(currentWeekStart)}>
              {t("food.plan.thisWeek")}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={busy || previous.length === 0}
            title={previous.length === 0 ? t("food.plan.copyEmpty") : undefined}
            onClick={() => {
              let copied = 0;
              void run(
                async () => {
                  copied = await copyLastWeek(userId, weekStart, entries);
                },
                () => setNotice(t("food.plan.copied", { count: number(copied) })),
              );
            }}
          >
            {t("food.plan.copyLastWeek")}
          </Button>
          {week.length > 0 && (
            <ConfirmDelete
              label={t("food.plan.clearWeek")}
              question={t("food.plan.confirmClear")}
              busy={busy}
              onConfirm={() => void run(() => clearWeek(userId, weekStart))}
            />
          )}
        </div>
      </div>

      {error && <ErrorNotice>{t("food.plan.saveError")}</ErrorNotice>}
      {notice && <p role="status" className="text-sm text-muted">{notice}</p>}

      {targets ? (
        average && (
          <p className="text-sm text-muted">
            {t("food.plan.weekAverage")}: <bdi>{totalLine(average)}</bdi>
          </p>
        )
      ) : (
        <p className="text-sm text-muted">
          {t("food.plan.noTargets")}{" "}
          <Link href="/body" className="underline">
            {t("food.plan.setUpTargets")}
          </Link>
        </p>
      )}

      <div className="flex gap-1 overflow-x-auto lg:hidden" role="group" aria-label={t("food.plan.days")}>
        {days.map((day) => (
          <button
            key={day}
            type="button"
            className="chip-toggle shrink-0"
            aria-pressed={day === selectedDay}
            onClick={() => setSelected(day)}
          >
            {weekday(weekdayOf(day))} <bdi>{number(Number(day.slice(8)))}</bdi>
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day) => {
          const total = dayTotals(week, day, lookup.recipes, lookup.foods);
          return (
            <Card
              key={day}
              className={`${day === selectedDay ? "block" : "hidden"} min-w-0 space-y-3 p-3 lg:block`}
            >
              <h3 className="font-semibold">
                {weekday(weekdayOf(day), "long")}{" "}
                <span className="text-sm font-normal text-muted">
                  <bdi>{date(day, { day: "numeric", month: "short" })}</bdi>
                </span>
              </h3>
              {MEAL_SLOTS.map((slot) => {
                const items = week
                  .filter((entry) => entry.plan_date === day && entry.slot === slot)
                  .sort((a, b) => a.position - b.position);
                return (
                  <section key={slot} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold uppercase text-muted">
                        {t(`food.slot.${slot}` as TranslationKey)}
                      </h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        aria-label={t("food.plan.addTo", { slot: t(`food.slot.${slot}` as TranslationKey) })}
                        onClick={() => setEditor({ mode: "add", day, slot })}
                      >
                        <Icon name="plus" size={14} />
                      </Button>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-xs text-muted">{t("food.plan.emptySlot")}</p>
                    ) : (
                      <ul className="space-y-1">
                        {items.map((entry) => {
                          const value = entryNutrition(entry, lookup.recipes, lookup.foods);
                          return (
                            <li key={entry.id}>
                              <button
                                type="button"
                                className="food-row w-full text-start"
                                onClick={() => setEditor({ mode: "edit", entry })}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium">
                                    <bdi>{name(entry)}</bdi>
                                  </span>
                                  <span className="block text-xs text-muted">
                                    <bdi>{t("food.plan.portionsValue", { value: number(entry.eaten_portions) })}</bdi>
                                    {value && (
                                      <>
                                        {" · "}
                                        <bdi>{format.kcal(value.kcal)}</bdi>
                                      </>
                                    )}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })}
              <p className="border-t border-border pt-2 text-xs text-muted">
                {t("food.plan.dayTotal")}: <bdi>{totalLine(total)}</bdi>
              </p>
            </Card>
          );
        })}
      </div>

      <Button onClick={onOpenGroceries}>{t("food.plan.groceriesLink")}</Button>

      <Sheet
        open={editor !== null}
        onClose={() => {
          setEditor(null);
          setError(false);
        }}
        title={
          editor?.mode === "edit"
            ? t("food.plan.editEntry")
            : editor
              ? t("food.plan.addTo", { slot: t(`food.slot.${editor.slot}` as TranslationKey) })
              : t("food.plan.editEntry")
        }
        busy={busy}
      >
        {editor && (
          <EntryForm
            key={editor.mode === "edit" ? editor.entry.id : `${editor.day}:${editor.slot}`}
            editor={editor}
            days={days}
            lookup={lookup}
            busy={busy}
            error={error}
            name={name}
            onCancel={() => setEditor(null)}
            onDelete={(entry) =>
              void run(() => deletePlanEntry(userId, entry.id), () => setEditor(null))
            }
            onSave={(values) =>
              void run(async () => {
                if (editor.mode === "add") {
                  await addPlanEntry(userId, {
                    ...values,
                    plan_date: editor.day,
                    slot: editor.slot,
                    position: nextPosition(week, editor.day, editor.slot),
                  });
                } else {
                  const moved =
                    values.plan_date !== editor.entry.plan_date || values.slot !== editor.entry.slot;
                  await updatePlanEntry(userId, editor.entry.id, {
                    plan_date: values.plan_date,
                    slot: values.slot,
                    cook_servings: values.cook_servings,
                    eaten_portions: values.eaten_portions,
                    note: values.note,
                    ...(moved ? { position: nextPosition(week, values.plan_date, values.slot) } : {}),
                  });
                }
              }, () => setEditor(null))
            }
          />
        )}
      </Sheet>
    </div>
  );
}

type FormValues = {
  plan_date: string;
  slot: MealSlot;
  recipe_id: string | null;
  food_id: string | null;
  cook_servings: number | null;
  eaten_portions: number;
  note: string | null;
};

function EntryForm({
  editor,
  days,
  lookup,
  busy,
  error,
  name,
  onCancel,
  onDelete,
  onSave,
}: {
  editor: Editor;
  days: string[];
  lookup: PlanLookup;
  busy: boolean;
  error: boolean;
  name: (entry: Pick<PlanEntry, "recipe_id" | "food_id">) => string;
  onCancel: () => void;
  onDelete: (entry: PlanEntry) => void;
  onSave: (values: FormValues) => void;
}) {
  const { t, weekday, date, number } = useLanguage();
  const format = useFoodFormat();
  const initial = editor.mode === "edit" ? editor.entry : null;
  const [kind, setKind] = useState<"recipe" | "food">(initial?.food_id ? "food" : "recipe");
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<{ recipe_id: string | null; food_id: string | null } | null>(
    initial ? { recipe_id: initial.recipe_id, food_id: initial.food_id } : null,
  );
  const [portions, setPortions] = useState(initial?.eaten_portions ?? 1);
  const [cook, setCook] = useState(
    initial?.cook_servings ? String(initial.cook_servings) : "",
  );
  const [day, setDay] = useState(initial?.plan_date ?? (editor.mode === "add" ? editor.day : days[0]!));
  const [slot, setSlot] = useState<MealSlot>(
    (initial?.slot as MealSlot | undefined) ?? (editor.mode === "add" ? editor.slot : "lunch"),
  );
  const [note, setNote] = useState(initial?.note ?? "");

  const results = useMemo(() => {
    if (choice) return [];
    const source =
      kind === "recipe"
        ? [...lookup.recipes].map(([id, recipe]) => ({ id, en: recipe.title_en, fa: recipe.title_fa }))
        : [...lookup.foods].map(([id, food]) => ({ id, en: food.name_en, fa: food.name_fa }));
    return source.filter((item) => matchesSearch(query, [item.en, item.fa])).slice(0, RESULTS);
  }, [choice, kind, lookup, query]);

  const recipe = choice?.recipe_id ? lookup.recipes.get(choice.recipe_id) : undefined;
  const cookValue = cook.trim() === "" ? null : Number(cook);
  const cookValid = cookValue === null || (Number.isFinite(cookValue) && cookValue >= 1 && cookValue <= 20);

  function submit() {
    if (!choice || !cookValid) return;
    onSave({
      plan_date: day,
      slot,
      recipe_id: choice.recipe_id,
      food_id: choice.food_id,
      cook_servings: choice.recipe_id
        ? clampServings(cookValue ?? recipe?.servings ?? 1)
        : null,
      eaten_portions: clampPortions(portions),
      note: note.trim() ? note.trim().slice(0, 300) : null,
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {choice ? (
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">
            <bdi>{name(choice)}</bdi>
          </p>
          {editor.mode === "add" && (
            <Button size="sm" variant="ghost" onClick={() => setChoice(null)}>
              {t("food.plan.change")}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <SegmentedControl
            label={t("food.plan.kind")}
            value={kind}
            onChange={setKind}
            options={[
              { value: "recipe", label: t("food.plan.kind.recipe") },
              { value: "food", label: t("food.plan.kind.food") },
            ]}
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("food.plan.search")}
            aria-label={t("food.plan.search")}
          />
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="food-row w-full text-start"
                  onClick={() => {
                    setChoice(kind === "recipe" ? { recipe_id: item.id, food_id: null } : { recipe_id: null, food_id: item.id });
                    if (kind === "recipe") setCook(String(lookup.recipes.get(item.id)?.servings ?? 1));
                  }}
                >
                  <bdi>{format.name(item.en, item.fa)}</bdi>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {choice && (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("food.plan.portions")}</legend>
            <div className="flex flex-wrap gap-2">
              {PORTION_CHOICES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="chip-toggle"
                  aria-pressed={portions === value}
                  onClick={() => setPortions(value)}
                >
                  <bdi>{number(value)}</bdi>
                </button>
              ))}
            </div>
          </fieldset>
          {choice.recipe_id && (
            <label className="block space-y-1">
              <span className="text-sm font-medium">{t("food.plan.cookServings")}</span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                value={cook}
                invalid={!cookValid}
                onChange={(event) => setCook(event.target.value)}
              />
            </label>
          )}
          {editor.mode === "edit" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium">{t("food.plan.day")}</span>
                <Select value={day} onChange={(event) => setDay(event.target.value)}>
                  {days.map((value) => (
                    <option key={value} value={value}>
                      {weekday(weekdayOf(value), "long")} · {date(value, { day: "numeric", month: "short" })}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">{t("food.plan.slot")}</span>
                <Select value={slot} onChange={(event) => setSlot(event.target.value as MealSlot)}>
                  {MEAL_SLOTS.map((value) => (
                    <option key={value} value={value}>
                      {t(`food.slot.${value}` as TranslationKey)}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          )}
          <label className="block space-y-1">
            <span className="text-sm font-medium">{t("food.plan.note")}</span>
            <Input value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} />
          </label>
        </>
      )}

      {error && <ErrorNotice>{t("food.plan.saveError")}</ErrorNotice>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" busy={busy} disabled={!choice || !cookValid}>
          {t("common.save")}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        {initial && (
          <ConfirmDelete
            label={t("food.plan.remove")}
            question={t("food.plan.confirmRemove")}
            busy={busy}
            onConfirm={() => onDelete(initial)}
          />
        )}
      </div>
    </form>
  );
}
