"use client";
import { useState } from "react";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { LogTotals } from "@/components/food/LogTotals";
import { QuickAddSheet } from "@/components/food/QuickAddSheet";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Button, Card, ErrorNotice, SectionHeading } from "@/components/ui";
import { useTodayContext } from "./TodayContext";

/**
 * Today's food: calories and protein against targets, and quick add.
 * Planned meals ("Ate as planned") join this card once the meal plan (S4) ships.
 */
export function MealsSection() {
  const { t } = useLanguage();
  const { food } = useTodayContext();
  const [adding, setAdding] = useState(false);
  if (!food.visible) return null;

  return (
    <Card>
      <SectionHeading
        title={t("foodLog.todayTitle")}
        action={
          <Link className="inline-flex min-h-8 items-center gap-1 text-sm text-primary" href="/food?tab=log">
            {t("foodLog.openLog")}
            <Icon name="chevron" size={15} />
          </Link>
        }
      />
      <div className="mt-4">
        <LogTotals targets={food.targets} totals={food.totals} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} />
          {t("foodLog.add")}
        </Button>
        {food.undo && !adding && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted" role="status">
            <bdi>{t("foodLog.logged", { label: food.undo.label })}</bdi>
            <Button size="sm" variant="ghost" disabled={food.busy} onClick={() => void food.undoLast()}>
              {t("foodLog.undo")}
            </Button>
          </p>
        )}
      </div>
      {food.failed && !adding && (
        <div className="mt-3">
          <ErrorNotice>{t("common.error")}</ErrorNotice>
        </div>
      )}
      <QuickAddSheet
        open={adding}
        onClose={() => setAdding(false)}
        catalog={null}
        recent={food.recent}
        busy={food.busy}
        error={food.failed}
        onAdd={async (draft) => {
          const ok = await food.add(draft);
          if (ok) setAdding(false);
          return ok;
        }}
      />
    </Card>
  );
}
