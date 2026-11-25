"use client";
import { useState } from "react";
import { useFoodFormat } from "@/components/food/shared";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Button, SegmentedControl } from "@/components/ui";
import type { FoodLogEntry } from "@/lib/db/foodLog";
import type { TodayPlannedMeal } from "@/lib/db/mealPlan";
import { MEAL_SLOTS, entryFromPlan, portionChoices, type MealSlot } from "@/lib/nutrition/log";
import { useTodayContext } from "./TodayContext";

/** Meals planned for today by slot; each is logged with one tap. */
export function PlannedMeals({ onSomethingElse }: { onSomethingElse: (slot: MealSlot) => void }) {
  const { t } = useLanguage();
  const { food } = useTodayContext();
  if (food.planned.length === 0) return null;

  return (
    <div className="mt-5 space-y-4">
      <h3 className="text-sm font-semibold">{t("foodLog.planned")}</h3>
      {MEAL_SLOTS.map((slot) => {
        const rows = food.planned.filter(({ meal }) => meal.slot === slot);
        if (rows.length === 0) return null;
        return (
          <section key={slot}>
            <h4 className="text-xs text-muted">{t(`foodLog.slot.${slot}`)}</h4>
            <ul className="mt-2 grid gap-2">
              {rows.map(({ meal, logged }) => (
                <PlannedRow
                  // A changed planned amount resets the portion choice.
                  key={`${meal.id}:${meal.portions}`}
                  meal={meal}
                  logged={logged}
                  onSomethingElse={() => onSomethingElse(slot)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function PlannedRow({
  meal,
  logged,
  onSomethingElse,
}: {
  meal: TodayPlannedMeal;
  logged: FoodLogEntry | null;
  onSomethingElse: () => void;
}) {
  const { t, number } = useLanguage();
  const format = useFoodFormat();
  const { food } = useTodayContext();
  const [portions, setPortions] = useState(String(meal.portions));
  const label = format.name(meal.name_en, meal.name_fa);
  // What is shown is exactly what gets stored.
  const values = logged ?? entryFromPlan(meal, Number(portions), label);
  const detail = [
    values.portions !== null && t("foodLog.portionsValue", { value: number(Number(values.portions)) }),
    format.kcal(Number(values.kcal)),
    format.protein(Number(values.protein)),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="space-y-3 rounded-2xl border border-border p-3">
      <div className="min-w-0">
        <p className="row-title">
          <bdi>{logged?.label ?? label}</bdi>
        </p>
        <p className="row-detail">
          {logged ? t("foodLog.plannedLogged", { value: detail }) : detail}
        </p>
      </div>
      {!logged && (
        <>
          <SegmentedControl
            label={t("foodLog.plannedPortions", { label })}
            value={portions}
            onChange={setPortions}
            options={portionChoices(meal.portions).map((value) => ({
              value: String(value),
              label: number(value),
            }))}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={food.busy}
              aria-label={`${t("foodLog.ateAsPlanned")}: ${label}`}
              onClick={() => void food.logPlanned(meal, Number(portions), label)}
            >
              {t("foodLog.ateAsPlanned")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={food.busy}
              aria-label={`${t("foodLog.ateSomethingElse")}: ${label}`}
              onClick={onSomethingElse}
            >
              {t("foodLog.ateSomethingElse")}
            </Button>
          </div>
        </>
      )}
    </li>
  );
}
