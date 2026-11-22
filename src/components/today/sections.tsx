"use client";
import type { ComponentType } from "react";
import { CheckinCard } from "./CheckinCard";
import { HealthSection } from "./HealthSection";
import { RemindersSection } from "./RemindersSection";
import { RoutinesSection } from "./RoutinesSection";
import { TasksSection } from "./TasksSection";
import { WeekSection } from "./WeekSection";
import { WorkoutsSection } from "./WorkoutsSection";

/**
 * Today section registry. Sections read their data from `useTodayContext()`,
 * so adding a section (for example "Weigh-in" or "Meals") is one entry here.
 */
export type TodaySection = { id: string; Component: ComponentType };

function HealthSportRow() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <HealthSection />
      <WorkoutsSection />
    </div>
  );
}

export const mainSections: TodaySection[] = [
  { id: "routines", Component: RoutinesSection },
  { id: "health-sport", Component: HealthSportRow },
  { id: "tasks", Component: TasksSection },
];

export const sideSections: TodaySection[] = [
  { id: "reminders", Component: RemindersSection },
  { id: "week", Component: WeekSection },
  { id: "checkin", Component: CheckinCard },
];
