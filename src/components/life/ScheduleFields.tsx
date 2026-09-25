"use client";
import { Input } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";

export function ScheduleFields({
  days,
  onDays,
  timezone,
  onTimezone,
  start,
  end,
  onStart,
  onEnd,
  daysInvalid = false,
  daysErrorId,
  daysError,
}: {
  days: number[];
  onDays: (value: number[]) => void;
  timezone: string;
  onTimezone: (value: string) => void;
  start?: string | undefined;
  end?: string | undefined;
  onStart?: ((value: string) => void) | undefined;
  onEnd?: ((value: string) => void) | undefined;
  daysInvalid?: boolean | undefined;
  daysErrorId?: string | undefined;
  daysError?: string | undefined;
}) {
  const { t, weekday, language } = useLanguage();
  return (
    <>
      <fieldset
        aria-invalid={daysInvalid || undefined}
        aria-describedby={daysInvalid ? daysErrorId : undefined}
      >
        <legend className="mb-2 text-sm">{t("common.days")}</legend>
        <div className="grid grid-cols-7 gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <button
              key={day}
              type="button"
              className="day-chip"
              aria-label={weekday(day, "long")}
              title={weekday(day, "long")}
              aria-pressed={days.includes(day)}
              onClick={() =>
                onDays(
                  days.includes(day)
                    ? days.filter((d) => d !== day)
                    : [...days, day].sort(),
                )
              }
            >
              {weekday(day, language === "fa" ? "narrow" : "short")}
            </button>
          ))}
        </div>
        {daysInvalid && daysError && (
          <p id={daysErrorId} className="field-error mt-2">
            {daysError}
          </p>
        )}
      </fieldset>
      <label className="grid gap-2 text-sm">
        {t("common.timezone")}
        <Input
          dir="ltr"
          value={timezone}
          onChange={(e) => onTimezone(e.target.value)}
          required
          maxLength={100}
        />
        <span className="text-muted">{t("schedule.timezoneBody")}</span>
      </label>
      {onStart && onEnd && (
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-2 text-sm">
            {t("common.start")}
            <Input
              type="date"
              value={start}
              onChange={(e) => onStart(e.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            {t("common.end")}
            <Input
              type="date"
              value={end}
              min={start}
              onChange={(e) => onEnd(e.target.value)}
            />
          </label>
        </div>
      )}
    </>
  );
}
