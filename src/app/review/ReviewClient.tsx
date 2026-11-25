"use client";
import { useEffect, useState } from "react";
import { Link } from "next-view-transitions";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import {
  Button,
  Card,
  ErrorNotice,
  PageHeader,
  PageShell,
  SectionHeading,
  Stat,
} from "@/components/ui";
import {
  acceptSuggestion,
  dismissSuggestion,
  loadReview,
  undoSuggestion,
  type ReviewData,
} from "@/lib/db/review";
import { observedRate } from "@/lib/nutrition/body";
import { dailyTargets } from "@/lib/nutrition/log";
import {
  ADJUSTMENT_KCAL,
  SUGGESTED_STEPS,
  loggedAverages,
  weekTrend,
  weeklySuggestion,
} from "@/lib/nutrition/review";
import { getLocalDateKey } from "@/lib/today";
import { useToday } from "@/lib/useToday";

export function ReviewClient({
  userId,
  initialData,
}: {
  userId: string;
  initialData: ReviewData | null;
}) {
  const { t, date, number, locale } = useLanguage();
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(initialData === null);
  const today = getLocalDateKey(useToday());

  // The server's day can differ from the device's (for example around midnight).
  useEffect(() => {
    if (initialData?.today === today) return;
    let cancelled = false;
    loadReview(userId, today)
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initialData, today, userId]);

  async function run(action: () => Promise<void>) {
    if (busy || !data) return;
    setBusy(true);
    setFailed(false);
    try {
      await action();
      setData(await loadReview(userId, data.today));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const decimal = (value: number, sign = false) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
      signDisplay: sign ? "exceptZero" : "auto",
    }).format(value);

  const header = (
    <PageHeader
      {...(data && {
        eyebrow: t("review.range", { start: date(data.week.start), end: date(data.week.end) }),
      })}
      title={t("review.title")}
      description={t("review.description")}
    />
  );
  const notice = failed && (
    <div className="mb-5">
      <ErrorNotice>{t("common.error")}</ErrorNotice>
    </div>
  );
  if (!data) {
    return (
      <PageShell>
        {header}
        {notice}
      </PageShell>
    );
  }

  const { profile, weighIns, adjustments, week } = data;
  const averages = loggedAverages(data.food);
  const trend = weekTrend(weighIns, week);
  const rate = observedRate(weighIns, data.today);
  const suggestion = weeklySuggestion(profile, weighIns, adjustments, data.today);
  const target = dailyTargets(profile, weighIns, adjustments, data.today)?.energy.kcal ?? null;
  const asks = ["lower", "raise", "steps"].includes(suggestion.kind) && !data.dismissed;

  return (
    <PageShell>
      {header}
      {notice}
      <div className="space-y-6">
        {profile && (
          <Card>
            <SectionHeading title={t("review.weight")} />
            {trend ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Stat label={t("review.trend")} value={t("review.kg", { value: decimal(trend.trendKg) })} />
                <Stat
                  label={t("review.change")}
                  value={
                    trend.changeKg === null
                      ? t("review.notEnough")
                      : t("review.kg", { value: decimal(trend.changeKg, true) })
                  }
                />
                <Stat
                  label={t("review.rate")}
                  value={
                    rate === null
                      ? t("review.notEnough")
                      : t("review.kgPerWeek", { value: decimal(rate, true) })
                  }
                />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">{t("review.noWeight")}</p>
            )}
          </Card>
        )}

        <Card>
          <SectionHeading title={t("review.food")} />
          {averages ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Stat label={t("review.avgKcal")} value={t("review.kcal", { value: number(averages.kcal) })} />
              <Stat label={t("review.avgProtein")} value={t("review.grams", { value: number(averages.protein) })} />
              <Stat label={t("review.daysLogged")} value={number(averages.days)} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">{t("review.noFood")}</p>
          )}
        </Card>

        <Card>
          <SectionHeading title={t("review.activity")} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Stat label={t("review.workouts")} value={number(data.workoutsDone)} />
            <Stat label={t("review.routines")} value={number(data.routinesDone)} />
          </div>
        </Card>

        {profile && (data.accepted || suggestion.kind !== "none") && (
          <Card tone="accent">
            <SectionHeading title={t("review.suggestion")} />
            {data.accepted ? (
              <>
                <p className="mt-3 text-sm leading-6">
                  {t("review.accepted", {
                    target: target === null ? "—" : number(target),
                  })}
                </p>
                <Button
                  className="mt-4"
                  disabled={busy}
                  onClick={() => void run(() => undoSuggestion(userId, week.start))}
                >
                  {t("review.undo")}
                </Button>
              </>
            ) : data.dismissed ? (
              <p className="mt-3 text-sm leading-6">{t("review.dismissed")}</p>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6">
                  {suggestion.kind === "lower" &&
                    t("review.lower", {
                      value: number(ADJUSTMENT_KCAL),
                      steps: number(SUGGESTED_STEPS),
                    })}
                  {suggestion.kind === "raise" &&
                    t("review.raise", { value: number(ADJUSTMENT_KCAL) })}
                  {suggestion.kind === "steps" &&
                    t("review.steps", { steps: number(SUGGESTED_STEPS) })}
                  {suggestion.kind === "keep" && t("review.keep")}
                  {suggestion.kind === "done" && t("review.done")}
                  {suggestion.kind === "recent" && t("review.recent")}
                  {suggestion.kind === "not_enough" && t("review.needWeighIns")}
                </p>
                {asks && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {suggestion.deltaKcal !== 0 && (
                      <Button
                        variant="primary"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            acceptSuggestion(userId, week.start, data.today, suggestion.deltaKcal),
                          )
                        }
                      >
                        {t("review.accept")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void run(() => dismissSuggestion(userId, week.start))}
                    >
                      {t("review.dismiss")}
                    </Button>
                  </div>
                )}
              </>
            )}
            <p className="mt-4 text-xs leading-5 text-muted">{t("body.notAdvice")}</p>
          </Card>
        )}
        {!profile && (
          <Link href="/body" className="btn btn-secondary">
            {t("review.setUpBody")}
          </Link>
        )}
      </div>
    </PageShell>
  );
}
