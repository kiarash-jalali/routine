import type { Task } from "@/types/task";

export function formatDueTime(
  task: Task,
  locale: string,
  anytime: string,
  today: Date,
  labels: { today: string; tomorrow: string; yesterday: string },
) {
  if (!task.due_at) return anytime;
  const due = new Date(task.due_at);
  const day = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = Math.round((day - base) / 86_400_000);
  const relative = diff === 0 ? labels.today : diff === 1 ? labels.tomorrow : diff === -1 ? labels.yesterday : null;
  if (!task.due_has_time) {
    return (
      relative ??
      new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
      }).format(due)
    );
  }

  const clock = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(due);
  return relative
    ? `${relative} · ${clock}`
    : new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(due);
}

export function sortTasks(tasks: Task[]) {
  return tasks.sort((a, b) => {
    if (a.is_done !== b.is_done) return Number(a.is_done) - Number(b.is_done);
    const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    return b.created_at.localeCompare(a.created_at);
  });
}
