"use client";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Card, SectionHeading } from "@/components/ui";
import { useTodayReminders } from "./useTodayReminders";

export function UpNextCard() {
  const { t } = useLanguage();
  const { todayReminders, nextReminder } = useTodayReminders();

  return (
    <Card tone={nextReminder ? "accent" : "soft"} className="mb-7">
      <SectionHeading title={t("dashboard.upNext")} />
      {nextReminder ? (
        <Link
          href={nextReminder.href}
          className="mt-4 flex min-h-16 items-center gap-4 rounded-2xl border border-border bg-surface/70 px-4 py-3 transition hover:border-border-strong hover:bg-surface"
        >
          <span className="icon-tile shrink-0">
            <Icon name={nextReminder.icon} size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">
              {nextReminder.label}
            </span>
            <span className="mt-1 block text-sm text-muted">
              {nextReminder.category}
            </span>
          </span>
          <span className="data-text shrink-0 text-sm text-muted">
            {nextReminder.displayTime}
          </span>
          <Icon name="chevron" size={17} />
        </Link>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted">
          {todayReminders.length
            ? t("dashboard.timedDone")
            : t("dashboard.noRemindersToday")}
        </p>
      )}
    </Card>
  );
}
