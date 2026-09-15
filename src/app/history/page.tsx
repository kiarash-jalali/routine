"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  PageShell,
  ProgressBar,
  SectionHeading,
  Stat,
} from "@/components/ui";
import {
  listCheckinDays,
  listRecentCheckinHistory,
} from "@/lib/db/history";
import {
  getPointBalance,
  listStreakRepairs,
  repairStreakDay,
} from "@/lib/db/points";
import { getErrorMessage } from "@/lib/errors";
import {
  averageCompletionPercent,
  buildRhythmDays,
  countRecentCheckins,
  formatHistoryDate,
  summarizeCheckin,
} from "@/lib/history";
import {
  CHECKIN_REWARD_POINTS,
  findRepairableDays,
  STREAK_REPAIR_COST_POINTS,
} from "@/lib/points";
import { supabaseBrowser } from "@/lib/supabaseClient";
import {
  calculateStreakMetrics,
  formatDayCount,
  streakMessage,
} from "@/lib/streak";
import type { CheckinHistoryEntry } from "@/types/history";
import type { StreakRepair } from "@/types/points";

function RhythmCell({
  checkedIn,
  repaired,
  completionPercent,
}: {
  checkedIn: boolean;
  repaired: boolean;
  completionPercent: number;
}) {
  const className = repaired
    ? "border-dashed border-primary/55 bg-primary-soft/35"
    : checkedIn
      ? completionPercent === 100
        ? "border-primary bg-primary"
        : "border-primary/30 bg-primary-soft"
      : "border-border bg-surface-soft";

  return (
    <span
      className={`block h-8 rounded-lg border transition ${className}`}
      aria-hidden="true"
    />
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<CheckinHistoryEntry[]>([]);
  const [checkinDays, setCheckinDays] = useState<string[]>([]);
  const [repairs, setRepairs] = useState<StreakRepair[]>([]);
  const [pointBalance, setPointBalance] = useState(0);
  const [repairingDay, setRepairingDay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const supabase = supabaseBrowser();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) {
          router.replace("/login");
          return;
        }

        const [recentHistory, allCheckinDays, streakRepairs, balance] =
          await Promise.all([
            listRecentCheckinHistory(user.id, 30),
            listCheckinDays(user.id),
            listStreakRepairs(user.id),
            getPointBalance(),
          ]);

        if (!cancelled) {
          setHistory(recentHistory);
          setCheckinDays(allCheckinDays);
          setRepairs(streakRepairs);
          setPointBalance(balance);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(
            getErrorMessage(error, "Your check-in history could not be loaded."),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const repairedDays = useMemo(
    () => repairs.map((repair) => repair.day),
    [repairs],
  );
  const repairedDaySet = useMemo(() => new Set(repairedDays), [repairedDays]);
  const effectiveRhythmDays = useMemo(
    () => [...checkinDays, ...repairedDays],
    [checkinDays, repairedDays],
  );
  const repairableDays = useMemo(
    () => findRepairableDays(checkinDays, repairedDays),
    [checkinDays, repairedDays],
  );
  const rhythmDays = useMemo(() => buildRhythmDays(history, 14), [history]);
  const checkedInLastSeven = useMemo(
    () => countRecentCheckins(history, 7),
    [history],
  );
  const averageCompletion = useMemo(
    () => averageCompletionPercent(history),
    [history],
  );
  const streak = useMemo(
    () => calculateStreakMetrics(effectiveRhythmDays),
    [effectiveRhythmDays],
  );

  async function repairDay(day: string) {
    setRepairingDay(day);
    setErrorMessage(null);

    try {
      const newBalance = await repairStreakDay(day);
      setPointBalance(newBalance);
      setRepairs((current) => [
        ...current,
        {
          day,
          cost_points: STREAK_REPAIR_COST_POINTS,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(error, "That missed day could not be repaired."),
      );
    } finally {
      setRepairingDay(null);
    }
  }

  return (
    <PageShell className="max-w-5xl">
      <AppNav />

      <PageHeader
        eyebrow="History"
        title="Your rhythm, over time."
        description="A quiet record of the days you checked in. This is context, not a scorecard."
      />

      {errorMessage && (
        <div className="mt-6">
          <ErrorNotice>{errorMessage}</ErrorNotice>
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading your history…</p>
      ) : history.length === 0 ? (
        <div className="mt-6">
          <EmptyState>
            No check-in history yet. Finish your first day and it will appear
            here.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <Card tone="accent">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Current rhythm
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                  {formatDayCount(streak.currentDays)}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {streakMessage(streak)}
                </p>
              </div>
              <div className="shrink-0 rounded-2xl border border-primary/15 bg-surface/70 px-4 py-3">
                <Stat
                  value={formatDayCount(streak.bestDays)}
                  label="best rhythm so far"
                />
              </div>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card tone="soft" className="p-4 sm:p-5">
              <Stat
                value={`${checkedInLastSeven}/7`}
                label="days checked in lately"
              />
            </Card>
            <Card tone="soft" className="p-4 sm:p-5">
              <Stat value={`${averageCompletion}%`} label="average completion" />
            </Card>
            <Card tone="soft" className="p-4 sm:p-5">
              <Stat value={history.length} label="recent check-ins shown" />
            </Card>
          </div>

          <Card>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <SectionHeading
                  title="Recovery"
                  description={`Finishing a day earns ${CHECKIN_REWARD_POINTS} points once. Repairing a missed rhythm day costs ${STREAK_REPAIR_COST_POINTS} points and restores continuity only — it does not create a fake check-in.`}
                />
              </div>
              <div className="shrink-0 rounded-2xl border border-primary/15 bg-primary-soft/35 px-4 py-3">
                <Stat value={pointBalance} label="recovery points" />
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-5">
              {repairableDays.length === 0 ? (
                <p className="text-sm leading-6 text-muted">
                  No repairable gaps right now. A missed day becomes repairable
                  only after you return and finish another real check-in.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    Missed days between real check-ins can be repaired. Repairing
                    them never changes the completion record for that day.
                  </p>
                  <div className="divide-y divide-border rounded-2xl border border-border bg-surface-soft px-4">
                    {repairableDays.map((day) => {
                      const canAfford = pointBalance >= STREAK_REPAIR_COST_POINTS;
                      const isRepairing = repairingDay === day;

                      return (
                        <div
                          key={day}
                          className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-medium text-foreground">
                              {formatHistoryDate(day)}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              Missed rhythm day · historical completion stays empty
                            </p>
                          </div>
                          <Button
                            className="shrink-0"
                            disabled={!canAfford || repairingDay !== null}
                            onClick={() => repairDay(day)}
                          >
                            {isRepairing
                              ? "Repairing…"
                              : `Repair · ${STREAK_REPAIR_COST_POINTS} pts`}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  {pointBalance < STREAK_REPAIR_COST_POINTS && (
                    <p className="text-xs text-muted">
                      You need {STREAK_REPAIR_COST_POINTS - pointBalance} more
                      points before you can repair one missed day.
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <SectionHeading
              title="Last 14 days"
              description="Filled days are real check-ins. A dashed day is a repaired streak gap, not a completed check-in."
            />

            <div className="mt-5 grid grid-cols-7 gap-2 sm:grid-cols-[repeat(14,minmax(0,1fr))]">
              {rhythmDays.map((day) => {
                const repaired = repairedDaySet.has(day.dateKey);

                return (
                  <div key={day.dateKey} className="min-w-0 text-center">
                    <RhythmCell
                      checkedIn={day.checkedIn}
                      repaired={repaired}
                      completionPercent={day.completionPercent}
                    />
                    <span className="mt-1.5 block text-[11px] text-muted">
                      {day.label}
                    </span>
                    <span className="sr-only">
                      {`${day.dateKey}: ${
                        repaired
                          ? "streak repaired; no check-in recorded"
                          : day.checkedIn
                            ? `${day.completedCount} of ${day.totalCount} completed`
                            : "no check-in"
                      }`}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-border bg-surface-soft" />
                No check-in
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-primary/30 bg-primary-soft" />
                Checked in
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-primary bg-primary" />
                Everything completed
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-dashed border-primary/55 bg-primary-soft/35" />
                Rhythm repaired
              </span>
            </div>
          </Card>

          <Card>
            <SectionHeading
              title="Recent check-ins"
              description="Your most recent 30 real daily check-ins. Repaired days are not added here."
            />

            <div className="mt-5 divide-y divide-border">
              {history.map((entry) => {
                const summary = summarizeCheckin(entry);

                return (
                  <article key={entry.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {formatHistoryDate(entry.day)}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {summary.totalCount === 0
                            ? "No routines or tasks were due."
                            : `${summary.routineCompletedCount}/${summary.routineTotalCount} routines · ${summary.taskCompletedCount}/${summary.taskTotalCount} tasks`}
                        </p>
                      </div>

                      {summary.totalCount === 0 ? (
                        <span className="text-xs font-medium text-primary">
                          Checked in
                        </span>
                      ) : (
                        <div className="flex items-center gap-3 sm:min-w-52">
                          <div className="min-w-0 flex-1">
                            <ProgressBar
                              value={summary.completedCount}
                              max={summary.totalCount}
                            />
                          </div>
                          <span className="w-10 text-right text-xs font-medium text-primary">
                            {summary.completionPercent}%
                          </span>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
