"use client";

import { useState } from "react";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Button, Card, ErrorNotice, PageShell, Pill, SectionHeading } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import {
  ConfirmDelete,
  NutritionGrid,
  TagChips,
  per100,
  useFoodFormat,
} from "@/components/food/shared";
import { deleteRecipe, saveRecipe, type RecipeDetail } from "@/lib/db/food";
import { foodNutrition } from "@/lib/nutrition/food";
import {
  MAX_SERVINGS,
  MIN_SERVINGS,
  clampServings,
  nutritionForServings,
  perServing,
  recipeCopyPayload,
  scaleGrams,
  servingsFactor,
} from "@/lib/nutrition/recipe";

export function BackToFood() {
  const { t } = useLanguage();
  return (
    <Link href="/food" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
      <Icon name="chevron" size={16} className="rotate-180 rtl:rotate-0" />
      {t("food.backToRecipes")}
    </Link>
  );
}

export function RecipeDetailClient({
  userId,
  detail,
  loadError,
}: {
  userId: string;
  detail: RecipeDetail | null;
  loadError: boolean;
}) {
  const { t, number, language } = useLanguage();
  const format = useFoodFormat();
  const router = useRouter();
  const base = detail?.recipe.servings ?? 1;
  const [servings, setServings] = useState(base);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);

  if (!detail) {
    return (
      <PageShell>
        <BackToFood />
        <ErrorNotice>{loadError ? t("food.loadError") : t("food.recipeMissing")}</ErrorNotice>
      </PageShell>
    );
  }

  const { recipe, ingredients } = detail;
  const own = recipe.owner_id === userId;
  const factor = servingsFactor(base, servings);
  const withFood = ingredients.map((item) => ({ grams: Number(item.grams), food: per100(item.food) }));
  const one = perServing(withFood, base);
  const total = nutritionForServings(withFood, base, servings);
  const title = format.name(recipe.title_en, recipe.title_fa);
  // The user's language first; the other language when that one is empty.
  const preferredSteps = language === "fa" ? recipe.steps_fa : recipe.steps_en;
  const otherSteps = language === "fa" ? recipe.steps_en : recipe.steps_fa;
  const steps = preferredSteps.length > 0 ? preferredSteps : otherSteps;
  const tip = format.name(recipe.tip_en, recipe.tip_fa);
  const side = per100(recipe.side);
  const factorText = number(Math.round(factor * 100) / 100);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setActionError(false);
    try {
      await action();
    } catch {
      setActionError(true);
      setBusy(false);
    }
  }

  function saveCopy() {
    void run(async () => {
      const payload = recipeCopyPayload(recipe, ingredients);
      const id = await saveRecipe(null, payload.recipe, payload.ingredients);
      router.push(`/food/recipes/${id}`);
    });
  }

  function remove() {
    void run(async () => {
      await deleteRecipe(userId, recipe.id);
      router.push("/food");
    });
  }

  return (
    <PageShell>
      <BackToFood />
      <header className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill muted>{format.category(recipe.category)}</Pill>
          <Pill muted={!own}>{own ? t("food.mine") : t("food.starter")}</Pill>
        </div>
        <h1 className="page-title">
          <bdi>{title}</bdi>
        </h1>
        <TagChips tags={recipe.tags} />
        {own && recipe.copied_from && <p className="text-sm text-muted">{t("food.copiedNote")}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {own ? (
            <>
              <Link href={`/food/recipes/${recipe.id}/edit`} className="btn btn-secondary btn-md">
                <Icon name="edit" size={16} />
                {t("common.edit")}
              </Link>
              <ConfirmDelete
                label={t("food.deleteRecipe")}
                question={t("food.confirmDeleteRecipe")}
                busy={busy}
                onConfirm={remove}
              />
            </>
          ) : (
            <Button variant="primary" busy={busy} onClick={saveCopy}>
              <Icon name="copy" size={16} />
              {t("food.saveToMine")}
            </Button>
          )}
        </div>
        {!own && <p className="text-sm text-muted">{t("food.saveToMineHint")}</p>}
        {actionError && <ErrorNotice>{t("food.actionError")}</ErrorNotice>}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="space-y-4 self-start">
          <SectionHeading title={t("food.nutritionPerServing")} />
          <NutritionGrid value={one} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-sm font-medium">{t("food.servings")}</span>
            <div className="servings-stepper">
              <button
                type="button"
                className="icon-button"
                aria-label={t("food.fewerServings")}
                disabled={servings <= MIN_SERVINGS}
                onClick={() => setServings((value) => clampServings(value - 1))}
              >
                <Icon name="minus" size={18} />
              </button>
              <output aria-live="polite" aria-label={t("food.servings")}>
                {number(servings)}
              </output>
              <button
                type="button"
                className="icon-button"
                aria-label={t("food.moreServings")}
                disabled={servings >= MAX_SERVINGS}
                onClick={() => setServings((value) => clampServings(value + 1))}
              >
                <Icon name="plus" size={18} />
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">
              {t("food.nutritionForServings", { count: number(servings) })}
            </h3>
            <NutritionGrid value={total} />
          </div>
          {recipe.side && side && Number(recipe.suggested_side_grams) > 0 && (
            <p className="text-sm text-muted">
              {t("food.sideSuggestion", {
                // First-strong isolate keeps an English name from reordering Persian punctuation.
                name: `⁨${format.name(recipe.side.name_en, recipe.side.name_fa)}⁩`,
                grams: number(Number(recipe.suggested_side_grams)),
                kcal: number(Math.round(foodNutrition(side, Number(recipe.suggested_side_grams)).kcal)),
              })}
            </p>
          )}
          <p className="text-xs text-muted">{t("food.approxNote")}</p>
        </Card>

        <div className="space-y-5">
          <Card className="space-y-3">
            <SectionHeading
              title={t("food.ingredients")}
              {...(servings !== base
                ? { description: t("food.scaledNote", { count: number(base) }) }
                : {})}
            />
            <ul className="divide-y divide-border">
              {ingredients.map((item) => {
                const name = format.name(
                  item.name_en ?? item.food?.name_en,
                  item.name_fa ?? item.food?.name_fa,
                );
                const amount = format.name(item.amount_en, item.amount_fa);
                return (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium">
                        <bdi>{name}</bdi>
                        {item.is_staple && (
                          <span className="ms-2 text-xs font-normal text-muted">{t("food.staple")}</span>
                        )}
                      </p>
                      {amount && (
                        <p className="text-sm text-muted">
                          <bdi>{amount}</bdi>
                          {factor !== 1 && <> · {t("food.timesFactor", { factor: factorText })}</>}
                        </p>
                      )}
                    </div>
                    {Number(item.grams) > 0 && (
                      <span className="shrink-0 text-sm tabular-nums">
                        <bdi>{format.grams(scaleGrams(Number(item.grams), factor))}</bdi>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
          {steps.length > 0 && (
            <Card className="space-y-3">
              <SectionHeading title={t("food.steps")} />
              <ol className="list-decimal space-y-2 ps-5 text-sm leading-6">
                {steps.map((step, index) => (
                  <li key={index}>
                    <bdi>{step}</bdi>
                  </li>
                ))}
              </ol>
            </Card>
          )}
          {tip && (
            <Card tone="soft" className="space-y-1">
              <h2 className="text-sm font-semibold">{t("food.tip")}</h2>
              <p className="text-sm leading-6">
                <bdi>{tip}</bdi>
              </p>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
