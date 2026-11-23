"use client";

import { useLanguage } from "@/components/preferences/LanguageProvider";
import type { DayPoint } from "@/lib/nutrition/log";

const WIDTH = 400;
const HEIGHT = 160;
const PAD = { top: 10, bottom: 24, side: 8 };

/**
 * Seven days of calories (bars) with the calorie target as a dashed line, and
 * protein per day under each bar. Plain SVG; in RTL the days run right-to-left.
 */
export function WeekChart({
  points,
  kcalTarget,
}: {
  points: DayPoint[];
  kcalTarget: number | null;
}) {
  const { t, date, number, language } = useLanguage();
  const rtl = language === "fa";
  const ordered = rtl ? [...points].reverse() : points;
  const max = Math.max(1, kcalTarget ?? 0, ...points.map((p) => p.kcal)) * 1.1;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = (WIDTH - PAD.side * 2) / Math.max(1, ordered.length);
  const barWidth = slot * 0.6;
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;
  const empty = points.every((p) => p.kcal === 0);

  return (
    <div>
      <h2 className="text-[17px] font-semibold tracking-tight">{t("foodLog.week")}</h2>
      {empty ? (
        <p className="mt-4 text-sm text-muted">{t("foodLog.weekEmpty")}</p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="mt-4 w-full"
            role="img"
            aria-label={t("foodLog.chartLabel")}
          >
            {ordered.map((point, index) => {
              const x = PAD.side + index * slot + (slot - barWidth) / 2;
              const top = y(point.kcal);
              return (
                <g key={point.day}>
                  <rect
                    x={x}
                    y={top}
                    width={barWidth}
                    height={Math.max(0, PAD.top + plotHeight - top)}
                    rx={4}
                    fill="var(--primary)"
                    opacity={0.85}
                  />
                  <text
                    x={x + barWidth / 2}
                    y={HEIGHT - 6}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--muted)"
                  >
                    {date(point.day, { weekday: "short" })}
                  </text>
                </g>
              );
            })}
            {kcalTarget !== null && (
              <line
                x1={PAD.side}
                x2={WIDTH - PAD.side}
                y1={y(kcalTarget)}
                y2={y(kcalTarget)}
                stroke="var(--amber)"
                strokeWidth={2}
                strokeDasharray="5 4"
              />
            )}
          </svg>
          {kcalTarget !== null && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted">
              <span aria-hidden="true" className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[var(--amber)]" />
              {t("foodLog.targetLine", { value: number(kcalTarget) })}
            </p>
          )}
          <table className="mt-3 w-full table-fixed text-center text-xs">
            <caption className="sr-only">{t("foodLog.chartTable")}</caption>
            <thead>
              <tr>
                {points.map((point) => (
                  <th key={point.day} scope="col" className="font-normal text-muted">
                    {date(point.day, { weekday: "short" })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {points.map((point) => (
                  <td key={point.day} className="tabular-nums text-foreground">
                    {number(point.kcal)}
                  </td>
                ))}
              </tr>
              <tr>
                {points.map((point) => (
                  <td key={point.day} className="tabular-nums text-muted">
                    {t("food.gramsValue", { value: number(Math.round(point.protein)) })}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
