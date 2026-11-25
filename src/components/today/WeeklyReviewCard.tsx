"use client";
import { useEffect, useState } from "react";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Card, SectionHeading } from "@/components/ui";
import { defaultWeekStart } from "@/lib/nutrition/body";
import { weekdayOf } from "@/lib/nutrition/plan";
import { useTodayContext } from "./TodayContext";

/** Link to the weekly review, shown only on the user's week start day (S7c). */
export function WeeklyReviewCard() {
  const { t, language } = useLanguage();
  const { todayKey, weighIn } = useTodayContext();
  const startsOn = weighIn.weekStartsOn ?? defaultWeekStart(language);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // The device's day can differ from the server's, so decide after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  if (!mounted || weekdayOf(todayKey) !== startsOn) return null;

  return (
    <Card>
      <SectionHeading
        title={t("review.todayTitle")}
        description={t("review.todayBody")}
        action={
          <Link className="inline-flex min-h-8 items-center gap-1 text-sm text-primary" href="/review">
            {t("review.open")}
            <Icon name="chevron" size={15} />
          </Link>
        }
      />
    </Card>
  );
}
