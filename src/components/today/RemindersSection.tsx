"use client";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Card, EmptyState, SectionHeading } from "@/components/ui";
import { useTodayReminders } from "./useTodayReminders";

export function RemindersSection() {
  const { t } = useLanguage();
  const { todayReminders } = useTodayReminders();

  return (
    <Card>
      <SectionHeading title={t("dashboard.remindersToday")} />
      <div className="mt-4">
        {todayReminders.length === 0 ? (
          <EmptyState>{t("dashboard.noRemindersToday")}</EmptyState>
        ) : (
          <div className="space-y-1">
            {todayReminders.map((reminder) => (
              <Link
                key={reminder.key}
                href={reminder.href}
                className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-soft"
              >
                <span className="icon-tile h-9 w-9 shrink-0 rounded-xl">
                  <Icon name={reminder.icon} size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {reminder.label}
                  </span>
                  <span className="block text-xs text-muted">
                    {reminder.category}
                  </span>
                </span>
                <span className="data-text text-xs text-muted">
                  {reminder.displayTime}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
