import type { Routine } from "@/types/routine";
import type { Task } from "@/types/task";

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


export function formatFriendlyDate(date = new Date()): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

// ISO weekday numbering matches the database: Monday=1 through Sunday=7.
export function getIsoWeekday(date = new Date()): number {
  const javascriptDay = date.getDay();
  return javascriptDay === 0 ? 7 : javascriptDay;
}

export function routineOccursOn(routine: Routine, date = new Date()): boolean {
  if (!routine.is_active) return false;
  if (routine.frequency === "daily") return true;

  return (routine.days_of_week ?? []).includes(getIsoWeekday(date));
}

export function filterTasksForToday(
  tasks: Task[],
  date = new Date(),
): Task[] {
  return tasks.filter((task) => {
    if (task.is_done) return false;
    if (!task.due_at) return true;

    const dueDate = new Date(task.due_at);
    if (Number.isNaN(dueDate.getTime())) return false;

    return (
      dueDate.getFullYear() === date.getFullYear() &&
      dueDate.getMonth() === date.getMonth() &&
      dueDate.getDate() === date.getDate()
    );
  });
}
