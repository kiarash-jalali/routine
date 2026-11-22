"use client";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { Collapse } from "@/components/Motion";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Button, Card, SectionHeading } from "@/components/ui";
import { useTodayContext } from "./TodayContext";

export function FirstSuccessCard({
  routineTitle,
  onDismiss,
}: {
  routineTitle: string | null;
  onDismiss: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Collapse show={!!routineTitle}>
      <Card tone="accent" className="mb-7">
        <div className="flex items-start gap-4">
          <span className="icon-tile shrink-0 bg-surface">
            <Icon name="spark" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {t("dashboard.firstSuccessEyebrow")}
            </p>
            <h2 className="display-title mt-1 text-2xl">
              {t("dashboard.firstSuccessTitle", {
                name: routineTitle ?? "",
              })}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {t("dashboard.firstSuccessBody")}
            </p>
            <Link href="/settings#reminders" className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-primary">
              <Icon name="clock" size={16} />
              {t("dashboard.setupReminder")}
            </Link>
          </div>
          <Button variant="ghost" onClick={onDismiss}>
            {t("common.done")}
          </Button>
        </div>
      </Card>
    </Collapse>
  );
}

export function DayOneCard() {
  const { t } = useLanguage();
  const { routines, todayTasks, todayMedication, todayWorkouts, checkedInToday, setShowTaskForm } =
    useTodayContext();
  const dayOne =
    routines.length === 0 &&
    todayTasks.length === 0 &&
    todayMedication.length === 0 &&
    todayWorkouts.length === 0 &&
    !checkedInToday;
  if (!dayOne) return null;

  return (
    <Card tone="accent" className="mb-7">
      <SectionHeading title={t("dashboard.dayOneTitle")} description={t("dashboard.dayOneBody")} />
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/routines" className="btn btn-primary">{t("routine.addSmall")}</Link>
        <button className="btn btn-secondary" onClick={() => setShowTaskForm(true)}>{t("product.addTask")}</button>
      </div>
    </Card>
  );
}
