"use client";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Card, SectionHeading } from "@/components/ui";
import { getLocalDateKey } from "@/lib/today";
import { useTodayContext } from "./TodayContext";

export function WeekSection() {
  const { t, locale, date, weekday } = useLanguage();
  const { today, rhythm } = useTodayContext();
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - ((today.getDay() + 6) % 7) + index);
    return date;
  });

  return (
    <Card>
      <SectionHeading title={t("product.week")} />
      <p className="mt-1 text-sm text-muted">
        {date(today, { month: "long", year: "numeric" })}
      </p>
      <div className="week-strip mt-4">
        {weekDays.map((date) => {
          const dateKey = getLocalDateKey(date);
          const isToday = dateKey === getLocalDateKey(today);
          const checked = rhythm?.recentCheckinDays.includes(dateKey);
          return (
            <div
              key={dateKey}
              className={`week-day ${isToday ? "is-today" : ""}`}
              aria-label={`${new Intl.DateTimeFormat(locale, {
                weekday: "long",
                month: "long",
                day: "numeric",
              }).format(date)}${isToday ? `, ${t("common.today")}` : ""}${checked ? `, ${t("dashboard.checkedIn")}` : ""}`}
            >
              <span>
                {weekday(date.getDay() === 0 ? 7 : date.getDay(), "narrow")}
              </span>
              <strong>{new Intl.DateTimeFormat(locale, { day: "numeric" }).format(date)}</strong>
              <span
                className={`week-dot ${checked ? "filled" : ""}`}
                aria-hidden="true"
              />
            </div>
          );
        })}
      </div>
      <Link
        href="/history"
        className="mt-4 flex min-h-11 items-center justify-between border-t border-border pt-4 text-sm text-muted"
      >
        {t("dashboard.viewRhythm")}
        <Icon name="arrow" size={16} />
      </Link>
    </Card>
  );
}
