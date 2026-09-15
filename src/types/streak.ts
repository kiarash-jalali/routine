export type StreakState = "checked-in-today" | "open-today" | "inactive";

export type StreakMetrics = {
  currentDays: number;
  bestDays: number;
  checkedInToday: boolean;
  state: StreakState;
};
