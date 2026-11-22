"use client";

import { ErrorNotice, PageHeader, PageShell } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { RecipeEditor } from "@/components/food/RecipeEditor";
import type { FoodRow, RecipeDetail } from "@/lib/db/food";
import { BackToFood } from "./[id]/RecipeDetailClient";

export function RecipeEditorPage({
  foods,
  initial,
  loadError,
  editing = false,
}: {
  foods: FoodRow[];
  initial: RecipeDetail | null;
  loadError: boolean;
  editing?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <PageShell>
      <BackToFood />
      <PageHeader
        title={editing ? t("food.editRecipe") : t("food.newRecipe")}
        description={t("food.editorDescription")}
      />
      {loadError ? (
        <ErrorNotice>{t("food.loadError")}</ErrorNotice>
      ) : (
        <RecipeEditor foods={foods} initial={initial} />
      )}
    </PageShell>
  );
}
