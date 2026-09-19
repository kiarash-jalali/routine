export type CheckinItemType = "task" | "routine";

export type DailyCheckinSummary = {
  id: string;
  user_id: string;
  day: string;
  submitted_at: string | null;
};

export type CheckinItem = {
  item_type: CheckinItemType;
  item_id: string;
  completed: boolean;
};

export type CheckinItemUpsert = CheckinItem & {
  user_id: string;
  checkin_id: string;
};

export type CheckinCompletionMap = Record<string, boolean>;
