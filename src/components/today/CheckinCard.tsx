"use client";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Card } from "@/components/ui";
import { useTodayContext } from "./TodayContext";

export function CheckinCard() {
  const { t } = useLanguage();
  const { checkedInToday } = useTodayContext();

  return (
    <Card tone="accent">
      <span className="icon-tile mb-5 bg-surface">
        <Icon name={checkedInToday ? "checkin" : "moon"} size={22} />
      </span>
      <h2 className="reflection-title">
        {checkedInToday
          ? t("dashboard.showedUp")
          : t("dashboard.moment")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        {checkedInToday
          ? t("dashboard.checkinSaved")
          : t("dashboard.reflect")}
      </p>
      <Link href="/checkin" className="btn btn-primary mt-5 w-full">
        {checkedInToday
          ? t("dashboard.viewCheckin")
          : t("dashboard.checkinToday")}
        <Icon name="arrow" size={17} />
      </Link>
    </Card>
  );
}
