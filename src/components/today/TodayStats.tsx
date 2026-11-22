"use client";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Stat } from "@/components/ui";
import { useTodayContext } from "./TodayContext";

export function TodayStats() {
  const { t, number } = useLanguage();
  const { routines, todayTasks, rhythm } = useTodayContext();
  const openTodayTasks = todayTasks.filter((task) => !task.is_done).length;

  return (
    <div className="stats-strip mb-7 grid grid-cols-3 divide-x divide-border rounded-2xl px-2 py-5 sm:px-5">
      <div className="px-3 sm:px-5">
        <Stat
          value={number(routines.length)}
          label={
            routines.length === 1
              ? t("dashboard.routineTodayCount")
              : t("dashboard.routinesTodayCount")
          }
        />
      </div>
      <div className="px-3 sm:px-5">
        <Stat
          value={number(openTodayTasks)}
          label={
            openTodayTasks === 1
              ? t("dashboard.openTaskCount")
              : t("dashboard.openTasksCount")
          }
        />
      </div>
      <div className="px-3 sm:px-5">
        <Stat
          value={rhythm ? number(rhythm.currentDays) : "—"}
          label={
            rhythm?.currentDays === 1
              ? t("dashboard.dayRhythm")
              : t("dashboard.daysRhythm")
          }
        />
      </div>
    </div>
  );
}
