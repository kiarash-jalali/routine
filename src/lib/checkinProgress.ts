import { filterTasksForToday } from "@/lib/today";
import type {
  CheckinCompletionMap,
  CheckinItem,
  CheckinItemType,
} from "@/types/checkin";
import type { Task } from "@/types/task";

export function checkinItemKey(
  itemType: CheckinItemType,
  itemId: string,
): string {
  return `${itemType}:${itemId}`;
}

export function completionMapFromItems(
  items: CheckinItem[],
): CheckinCompletionMap {
  return Object.fromEntries(
    items.map((item) => [
      checkinItemKey(item.item_type, item.item_id),
      item.completed,
    ]),
  );
}

export function tasksForDailyCheckin(
  tasks: Task[],
  items: CheckinItem[],
  date = new Date(),
): Task[] {
  const taskIds = new Set(filterTasksForToday(tasks, date).map((task) => task.id));
  for (const item of items) {
    if (item.item_type === "task") taskIds.add(item.item_id);
  }
  return tasks.filter((task) => taskIds.has(task.id));
}
