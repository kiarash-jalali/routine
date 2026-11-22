"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import {
  dayFromNumber,
  dayNumber,
  trendWeights,
  weeklyAverages,
  type WeighIn,
} from "@/lib/nutrition/body";

const WIDTH = 400;
const HEIGHT = 200;
const PAD = { top: 12, bottom: 26, axis: 40, edge: 10 };

/**
 * Daily weigh-ins (dots), the trend line and weekly averages (steps).
 * Plain SVG; in RTL the time axis runs right-to-left and the weight axis
 * sits on the right, so "newer" always points the reading direction.
 */
export function WeightChart({
  points,
  today,
  weekStartsOn,
}: {
  points: WeighIn[];
  today: string;
  weekStartsOn: number;
}) {
  const { t, date, language, locale } = useLanguage();
  const [range, setRange] = useState<"30" | "90">("30");
  const rtl = language === "fa";
  const days = Number(range);
  const end = dayNumber(today);
  const start = end - days + 1;

  // Trend uses all history so the line is warmed up at the window's edge.
  const trend = trendWeights(points).filter((p) => dayNumber(p.day) >= start);
  const weeks = weeklyAverages(
    points.filter((p) => dayNumber(p.day) >= start),
    weekStartsOn,
  );

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[17px] font-semibold tracking-tight">{t("body.chart")}</h2>
      <div>
        <SegmentedControl
          value={range}
          onChange={setRange}
          label={t("body.chartRange")}
          options={[
            { value: "30", label: t("body.chartRange30") },
            { value: "90", label: t("body.chartRange90") },
          ]}
        />
      </div>
    </div>
  );

  if (trend.length < 2) {
    return (
      <div>
        {header}
        <p className="mt-4 text-sm text-muted">{t("body.chartEmpty")}</p>
      </div>
    );
  }

  const values = trend.flatMap((p) => [p.weightKg, p.trendKg]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = Math.max(1, rawMax - rawMin);
  const min = Math.floor(rawMin - spread * 0.1);
  const max = Math.ceil(rawMax + spread * 0.1);

  const plotStart = rtl ? PAD.edge : PAD.axis;
  const plotEnd = rtl ? WIDTH - PAD.axis : WIDTH - PAD.edge;
  const plotWidth = plotEnd - plotStart;
  const x = (day: number) => {
    const share = days === 1 ? 1 : (day - start) / (days - 1);
    return rtl ? plotEnd - share * plotWidth : plotStart + share * plotWidth;
  };
  const y = (kg: number) =>
    PAD.top + ((max - kg) / (max - min)) * (HEIGHT - PAD.top - PAD.bottom);

  const trendPath = trend
    .map((p, i) => `${i ? "L" : "M"}${x(dayNumber(p.day)).toFixed(1)} ${y(p.trendKg).toFixed(1)}`)
    .join(" ");
  const ticks = [min, (min + max) / 2, max];
  const axisX = rtl ? WIDTH - PAD.axis + 6 : PAD.axis - 6;
  const shortDate = (day: string) => date(day, { month: "short", day: "numeric" });
  const kg = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  const first = trend[0];
  const last = trend[trend.length - 1];

  return (
    <div>
      {header}
      <svg
        className="mt-4 h-auto w-full"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        // Coordinates are mirrored by hand; keep SVG text anchors physical.
        direction="ltr"
        role="img"
        aria-label={t("body.chartLabel", {
          from: first ? shortDate(first.day) : "",
          to: last ? shortDate(last.day) : "",
          min: t("body.kgValue", { value: kg(rawMin) }),
          max: t("body.kgValue", { value: kg(rawMax) }),
        })}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={plotStart}
              x2={plotEnd}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x={axisX}
              y={y(tick) + 4}
              textAnchor={rtl ? "start" : "end"}
              fontSize="11"
              fill="var(--muted)"
            >
              {kg(tick)}
            </text>
          </g>
        ))}
        {weeks.map((week) => {
          const from = Math.max(start, dayNumber(week.weekStart));
          const to = Math.min(end, dayNumber(week.weekStart) + 6);
          return (
            <line
              key={week.weekStart}
              x1={x(from)}
              x2={x(to)}
              y1={y(week.averageKg)}
              y2={y(week.averageKg)}
              stroke="var(--amber)"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          );
        })}
        {trend.map((p) => (
          <circle
            key={p.day}
            cx={x(dayNumber(p.day))}
            cy={y(p.weightKg)}
            r="3"
            fill="var(--muted)"
            opacity="0.55"
          />
        ))}
        <path d={trendPath} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" />
        <text
          x={plotStart}
          y={HEIGHT - 6}
          textAnchor="start"
          fontSize="11"
          fill="var(--muted)"
        >
          {shortDate(dayFromNumber(rtl ? end : start))}
        </text>
        <text x={plotEnd} y={HEIGHT - 6} textAnchor="end" fontSize="11" fill="var(--muted)">
          {shortDate(dayFromNumber(rtl ? start : end))}
        </text>
      </svg>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block size-2 rounded-full bg-muted opacity-60" />
          {t("body.chartDaily")}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-primary" />
          {t("body.chartTrend")}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[var(--amber)]" />
          {t("body.chartWeekly")}
        </li>
      </ul>
    </div>
  );
}
