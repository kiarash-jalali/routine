import type { CheckinItemType, DailyCheckinSummary } from "@/types/checkin";

export type HistoricalCheckinItem = {
  checkin_id: string;
  item_type: CheckinItemType;
  item_id: string;
  completed: boolean;
};

export type CheckinHistoryEntry = DailyCheckinSummary & {
  items: HistoricalCheckinItem[];
};

export type CheckinHistorySummary = {
  completedCount: number;
  totalCount: number;
  completionPercent: number;
  routineCompletedCount: number;
  routineTotalCount: number;
  taskCompletedCount: number;
  taskTotalCount: number;
};

export type RhythmDay = {
  dateKey: string;
  label: string;
  checkedIn: boolean;
  completionPercent: number;
  completedCount: number;
  totalCount: number;
};
