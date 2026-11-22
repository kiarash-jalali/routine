"use client";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { MomentSource } from "@/components/MomentPopup";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Card, CheckCircle, EmptyState, SectionHeading } from "@/components/ui";
import { checkinItemKey } from "@/lib/checkinProgress";
import { useTodayContext } from "./TodayContext";

export function RoutinesSection() {
  const { t, time } = useLanguage();
  const { routines, completionByItem, pendingIds, toggleRoutine } = useTodayContext();

  return (
    <Card>
      <SectionHeading
        title={t("product.routinesToday")}
        action={
          <Link
            className="inline-flex min-h-8 items-center gap-1 text-sm text-primary"
            href="/routines"
          >
            {t("common.manage")}
            <Icon name="chevron" size={15} />
          </Link>
        }
      />
      <div className="mt-6">
        {routines.length === 0 ? (
          <EmptyState
            action={
              <Link href="/routines" className="btn btn-secondary">
                {t("routine.addSmall")}
                <Icon name="arrow" size={16} />
              </Link>
            }
          >
            {t("product.noRoutines")}
          </EmptyState>
        ) : (
          <ul>
            {routines.map((routine) => {
              const completionKey = checkinItemKey("routine", routine.id);
              const completed = Boolean(completionByItem[completionKey]);
              return (
              <li
                className={`list-row ${completed ? "is-done" : ""}`}
                key={routine.id}
              >
                <MomentSource id={`routine-${routine.id}`}>
                  <button
                    className="check-control -ms-2"
                    aria-pressed={completed}
                    aria-label={t(
                      completed
                        ? "routine.reopenNamed"
                        : "routine.completeNamed",
                      { name: routine.title },
                    )}
                    disabled={pendingIds.includes(completionKey)}
                    onClick={() => toggleRoutine(routine)}
                  >
                    <CheckCircle checked={completed} />
                  </button>
                </MomentSource>
                <div className="min-w-0 flex-1">
                  <p className="row-title">{routine.title}</p>
                  <p className="row-detail">
                    {routine.frequency === "daily"
                      ? t("routine.everyDay")
                      : t("routine.weekly")}
                  </p>
                </div>
                <span className="data-text text-xs text-muted">
                  {routine.preferred_time
                    ? time(routine.preferred_time)
                    : t("common.anytime")}
                </span>
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
