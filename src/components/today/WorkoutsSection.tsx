"use client";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Card, CheckCircle, EmptyState, SectionHeading } from "@/components/ui";
import { useTodayContext } from "./TodayContext";

export function WorkoutsSection() {
  const { t, time } = useLanguage();
  const { todayWorkouts, pendingIds, toggleWorkout } = useTodayContext();

  return (
    <Card>
      <SectionHeading
        title={t("dashboard.sportToday")}
        action={
          <Link
            className="inline-flex min-h-8 items-center gap-1 text-sm text-primary"
            href="/workouts"
          >
            {t("common.manage")}
            <Icon name="chevron" size={15} />
          </Link>
        }
      />
      <div className="mt-5">
        {todayWorkouts.length === 0 ? (
          <EmptyState
            action={
              <Link href="/workouts" className="btn btn-secondary">
                {t("workout.add")}
              </Link>
            }
          >
            {t("dashboard.noSportToday")}
          </EmptyState>
        ) : (
          <ul>
            {todayWorkouts.map((session) => {
              const pendingKey = `workout:${session.id}`;
              const completed = Boolean(session.completed_at);
              return (
                <li
                  key={session.id}
                  className={`list-row ${completed ? "is-done" : ""}`}
                >
                  <button
                    className="check-control -ms-2"
                    aria-pressed={completed}
                    aria-label={
                      completed
                        ? t("workout.undo")
                        : t("workout.complete")
                    }
                    disabled={pendingIds.includes(pendingKey)}
                    onClick={() => void toggleWorkout(session)}
                  >
                    <CheckCircle checked={completed} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="row-title">
                      <bdi>{session.name}</bdi>
                    </p>
                    <p className="row-detail">
                      <bdi>{session.activity_type}</bdi>
                      {" · "}
                      {time(session.scheduled_time)}
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
