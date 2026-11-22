"use client";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Card, CheckCircle, EmptyState, SectionHeading } from "@/components/ui";
import { useTodayContext } from "./TodayContext";

export function HealthSection() {
  const { t, time } = useLanguage();
  const { todayMedication, pendingIds, toggleMedication } = useTodayContext();

  return (
    <Card>
      <SectionHeading
        title={t("dashboard.healthToday")}
        action={
          <Link
            className="inline-flex min-h-8 items-center gap-1 text-sm text-primary"
            href="/health"
          >
            {t("common.manage")}
            <Icon name="chevron" size={15} />
          </Link>
        }
      />
      <div className="mt-5">
        {todayMedication.length === 0 ? (
          <EmptyState
            action={
              <Link href="/health" className="btn btn-secondary">
                {t("health.add")}
              </Link>
            }
          >
            {t("dashboard.noMedicationToday")}
          </EmptyState>
        ) : (
          <ul>
            {todayMedication.map((reminder) => {
              const pendingKey = `medication:${reminder.id}`;
              const taken = Boolean(reminder.taken_at);
              return (
                <li
                  key={reminder.id}
                  className={`list-row ${taken ? "is-done" : ""}`}
                >
                  <button
                    className="check-control -ms-2"
                    aria-pressed={taken}
                    aria-label={
                      taken ? t("health.undo") : t("health.taken")
                    }
                    disabled={pendingIds.includes(pendingKey)}
                    onClick={() => void toggleMedication(reminder)}
                  >
                    <CheckCircle checked={taken} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="row-title">
                      <bdi>{reminder.name}</bdi>
                    </p>
                    <p className="row-detail">
                      {reminder.dose ? (
                        <>
                          <bdi>{reminder.dose}</bdi>
                          {" · "}
                        </>
                      ) : null}
                      {time(reminder.scheduled_time)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
