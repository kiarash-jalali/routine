"use client";

import type { ReactNode } from "react";
import { Card, Pill } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import {
  bmi,
  energyTarget,
  observedRate,
  proteinTarget,
  sevenDayAverage,
  trendWeights,
  waistBand,
  waistToHeight,
  type WeighIn,
} from "@/lib/nutrition/body";
import type { BodyMeasurement, BodyProfile } from "@/types/body";

function Metric({
  label,
  value,
  detail,
  badge,
  placeholder = false,
}: {
  label: string;
  value: ReactNode;
  placeholder?: boolean;
  detail?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <Card tone="soft" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-muted">{label}</p>
        {badge}
      </div>
      <p
        className={
          placeholder
            ? "mt-2 text-base font-medium text-muted"
            : "stat-value mt-2 text-2xl tracking-tight"
        }
      >
        {value}
      </p>
      {detail && <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>}
    </Card>
  );
}

export function BodyMetrics({
  profile,
  measurements,
  today,
}: {
  profile: BodyProfile;
  measurements: BodyMeasurement[];
  today: string;
}) {
  const { t, locale } = useLanguage();
  const fmt = (value: number, digits = 1) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);

  const points: WeighIn[] = measurements
    .filter((m) => m.weight_kg !== null)
    .map((m) => ({ day: m.measured_on, weightKg: Number(m.weight_kg) }));
  const trend = trendWeights(points);
  const current = trend[trend.length - 1]?.trendKg ?? null;
  const average = sevenDayAverage(points, today);
  const rate = observedRate(points, today);
  const waist = measurements.find((m) => m.waist_cm !== null)?.waist_cm ?? null;
  const ratio = waist === null ? null : waistToHeight(Number(waist), profile.height_cm);
  const energy = energyTarget(profile, current, Number(today.slice(0, 4)));
  const protein = proteinTarget(profile, current);
  const setByYou = <Pill>{t("body.setByYou")}</Pill>;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Metric
        label={t("body.trend")}
        placeholder={current === null}
        value={current === null ? t("body.noWeight") : t("body.kgValue", { value: fmt(current) })}
        detail={
          average === null
            ? undefined
            : t("body.sevenDay", { value: t("body.kgValue", { value: fmt(average) }) })
        }
      />
      <Metric
        label={t("body.observedRate")}
        placeholder={rate === null}
        value={
          rate === null
            ? t("body.notEnoughData")
            : t("body.kgWeekValue", { value: `${rate > 0 ? "+" : ""}${fmt(rate, 2)}` })
        }
      />
      <Metric
        label={t("body.bmi")}
        value={current === null ? "—" : fmt(bmi(current, profile.height_cm))}
      />
      <Metric
        label={t("body.waistToHeight")}
        value={ratio === null ? "—" : fmt(ratio, 2)}
        detail={ratio === null ? t("body.noWaist") : t(`body.band.${waistBand(ratio)}`)}
      />
      <Metric
        label={t("body.kcalTarget")}
        badge={energy.source === "user" ? setByYou : undefined}
        placeholder={energy.kcal === null}
        value={
          energy.kcal === null
            ? t("body.kcalNeedsWeight")
            : t("body.kcalValue", { value: fmt(energy.kcal, 0) })
        }
        detail={
          energy.clamped
            ? t("body.capped")
            : energy.tdee !== null
              ? t("body.maintenance", {
                  value: t("body.kcalValue", { value: fmt(energy.tdee, 0) }),
                })
              : undefined
        }
      />
      <Metric
        label={t(protein.mode === "limit" ? "body.proteinLimit" : "body.proteinTarget")}
        badge={protein.source === "user" ? setByYou : undefined}
        value={t("body.gValue", { value: fmt(protein.grams, 0) })}
        detail={protein.mode === "limit" ? t("body.protein.limitBody") : undefined}
      />
    </div>
  );
}
