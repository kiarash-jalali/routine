"use client";

import { Link } from "next-view-transitions";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { proteinBarState } from "@/lib/nutrition/body";
import type { DailyTargets, Macros } from "@/lib/nutrition/log";

function Bar({ value, max, amber }: { value: number; max: number; amber?: boolean }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary-soft" aria-hidden="true">
      <div
        className={amber ? "h-full rounded-full bg-amber" : "h-full rounded-full bg-primary"}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/**
 * Calories and protein eaten against the S2 targets. Without a body profile
 * there are no targets, so it shows a "Set up your targets" link instead.
 * Limit mode reads "x of y g limit" and turns amber above 90 % (§4.3).
 */
export function LogTotals({
  targets,
  totals,
}: {
  targets: DailyTargets | null;
  totals: Macros;
}) {
  const { t, number } = useLanguage();
  if (!targets) {
    return (
      <div className="text-sm leading-6 text-muted">
        <p>{t("foodLog.setUpBody")}</p>
        <Link href="/body" className="mt-1 inline-flex min-h-8 items-center text-primary">
          {t("foodLog.setUpTargets")}
        </Link>
      </div>
    );
  }

  const kcalTarget = targets.energy.kcal;
  const protein = targets.protein;
  const eatenKcal = number(Math.round(totals.kcal));
  const eatenProtein = number(Math.round(totals.protein));
  const amber = proteinBarState(totals.protein, protein) === "amber";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="min-w-0">
        <p className="text-sm text-foreground">
          <bdi>
            {kcalTarget === null
              ? t("foodLog.totalsKcalNoTarget", { eaten: eatenKcal })
              : t("foodLog.totalsKcal", { eaten: eatenKcal, target: number(kcalTarget) })}
          </bdi>
        </p>
        {kcalTarget === null ? (
          <p className="mt-1 text-xs text-muted">{t("foodLog.noKcalTarget")}</p>
        ) : (
          <Bar value={totals.kcal} max={kcalTarget} />
        )}
        {targets.adjustedBy !== 0 && (
          <p className="mt-1 text-xs text-muted">
            {t("foodLog.adjusted", { value: number(targets.adjustedBy) })}
          </p>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-foreground">
          <bdi>
            {t(protein.mode === "limit" ? "foodLog.totalsProteinLimit" : "foodLog.totalsProtein", {
              eaten: eatenProtein,
              target: number(protein.grams),
            })}
          </bdi>
        </p>
        <Bar value={totals.protein} max={protein.grams} amber={amber} />
        {amber && <p className="mt-1 text-xs text-amber">{t("foodLog.limitNear")}</p>}
      </div>
    </div>
  );
}
