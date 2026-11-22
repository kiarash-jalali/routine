"use client";
import { useMemo } from "react";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { checkinItemKey } from "@/lib/checkinProgress";
import { useTodayContext } from "./TodayContext";

export function useTodayReminders() {
  const { t, locale, time } = useLanguage();
  const { todayTasks, routines, todayMedication, todayWorkouts, completionByItem } =
    useTodayContext();

  const todayReminders = useMemo(() => {
    const taskItems = todayTasks
      .filter((task) => task.due_at && task.due_has_time)
      .map((task) => {
        const due = new Date(task.due_at as string);
        const timeKey = `${String(due.getHours()).padStart(2, "0")}:${String(
          due.getMinutes(),
        ).padStart(2, "0")}`;
        return {
          key: `task-${task.id}`,
          icon: "today" as const,
          label: task.title,
          category: t("reminder.tasks"),
          timeKey,
          displayTime: new Intl.DateTimeFormat(locale, {
            hour: "2-digit",
            minute: "2-digit",
          }).format(due),
          href: "/dashboard",
          completed: task.is_done,
        };
      });

    const routineItems = routines
      .filter((routine) => routine.preferred_time)
      .map((routine) => ({
        key: `routine-${routine.id}`,
        icon: "routines" as const,
        label: routine.title,
        category: t("reminder.routines"),
        timeKey: routine.preferred_time?.slice(0, 5) ?? "99:99",
        displayTime: routine.preferred_time
          ? time(routine.preferred_time)
          : t("common.anytime"),
        href: "/routines",
        completed: Boolean(
          completionByItem[checkinItemKey("routine", routine.id)],
        ),
      }));

    const medicationItems = todayMedication.map((reminder) => ({
      key: `medication-${reminder.id}`,
      icon: "health" as const,
      label: reminder.name,
      category: t("reminder.medication"),
      timeKey: reminder.scheduled_time.slice(0, 5),
      displayTime: time(reminder.scheduled_time),
      href: "/health",
      completed: Boolean(reminder.taken_at),
    }));

    const workoutItems = todayWorkouts.map((session) => ({
      key: `workout-${session.id}`,
      icon: "sport" as const,
      label: session.name,
      category: t("reminder.sport"),
      timeKey: session.scheduled_time.slice(0, 5),
      displayTime: time(session.scheduled_time),
      href: "/workouts",
      completed: Boolean(session.completed_at),
    }));

    return [
      ...taskItems,
      ...routineItems,
      ...medicationItems,
      ...workoutItems,
    ].sort((a, b) => a.timeKey.localeCompare(b.timeKey));
  }, [
    completionByItem,
    locale,
    routines,
    t,
    time,
    todayMedication,
    todayTasks,
    todayWorkouts,
  ]);
  const nextReminder = todayReminders.find((reminder) => !reminder.completed);

  return { todayReminders, nextReminder };
}
