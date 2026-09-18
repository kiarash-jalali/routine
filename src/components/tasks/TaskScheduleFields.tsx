"use client";

import { Input } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { getLocalDateKey } from "@/lib/today";

function splitLocalDateTime(value: string) {
  const [date = "", time = ""] = value.split("T");
  return { date, time };
}

function combineLocalDateTime(date: string, time: string) {
  if (!date && !time) return "";

  // A time on its own means today; a date on its own means by the end of day.
  const resolvedDate = date || getLocalDateKey(new Date());
  const resolvedTime = time || "23:59";
  return `${resolvedDate}T${resolvedTime}`;
}

export function TaskScheduleFields({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const { date, time } = splitLocalDateTime(value);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{t("task.due")}</p>
        <p className="mt-1 text-sm font-normal text-muted">
          {t("task.dueBody")}
        </p>
      </div>

      <div className="task-schedule-grid">
        <label className="grid gap-2 text-sm font-medium">
          <span className="text-xs font-medium text-muted">{t("task.date")}</span>
          <Input
            type="date"
            value={date}
            onChange={(event) =>
              onChange(combineLocalDateTime(event.target.value, time))
            }
            disabled={disabled}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          <span className="text-xs font-medium text-muted">{t("task.time")}</span>
          <Input
            type="time"
            value={time}
            onChange={(event) =>
              onChange(combineLocalDateTime(date, event.target.value))
            }
            disabled={disabled}
          />
        </label>
      </div>

      <p className="text-xs leading-5 text-muted">
        {t("task.timeOnlyBody")}
      </p>
    </div>
  );
}
