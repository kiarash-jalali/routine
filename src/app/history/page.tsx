"use client";

import { useEffect, useMemo, useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { AnimatedList, AnimatedListItem } from "@/components/Motion";
import {
  Button,
  LoadingState,
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  PageShell,
  ProgressBar,
  SectionHeading,
  Stat,
} from "@/components/ui";
import { listCheckinDays, listRecentCheckinHistory } from "@/lib/db/history";
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
import { calculateStreakMetrics, formatDayCount } from "@/lib/streak";
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
      className={`block h-11 rounded-xl border transition ${className}`}
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
  const [showAll, setShowAll] = useState(false);
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
            getErrorMessage(
              error,
              "Your check-in history could not be loaded.",
            ),
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
    <PageShell>
      <PageHeader
        eyebrow="Every return counts"
        title="Your rhythm"
        description="A little perspective on the days you showed up."
      />
      {errorMessage && (
        <div className="mb-6">
          <ErrorNotice>{errorMessage}</ErrorNotice>
        </div>
      )}
      {loading ? (
        <LoadingState label="Loading your history…" />
      ) : history.length === 0 ? (
        <Card>
          <EmptyState>
            Your story starts with a check-in.
            <br />
            Finish your first day and it will appear here.
            <div className="mt-4">
              <Link href="/checkin" className="btn btn-primary">
                Check in today
                <Icon name="arrow" size={16} />
              </Link>
            </div>
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-4">
              <Stat
                value={formatDayCount(streak.currentDays)}
                label="current rhythm"
              />
              <Stat
                value={formatDayCount(streak.bestDays)}
                label="longest rhythm"
              />
              <Stat
                value={`${checkedInLastSeven} / 7`}
                label="check-ins this week"
              />
              <Stat
                value={`${averageCompletion}%`}
                label="average completion"
              />
            </div>
          </Card>
          <Card>
            <SectionHeading
              title="The last two weeks"
              description="Each check-in is a small step forward."
            />
            <div className="mt-6 grid grid-cols-7 gap-3 sm:grid-cols-[repeat(14,minmax(0,1fr))]">
              {rhythmDays.map((day) => {
                const repaired = repairedDaySet.has(day.dateKey);
                return (
                  <div
                    key={day.dateKey}
                    className="min-w-0 text-center"
                    title={`${day.dateKey}: ${repaired ? "Rhythm repaired" : day.checkedIn ? "Checked in" : "No check-in"}`}
                  >
                    <RhythmCell
                      checkedIn={day.checkedIn}
                      repaired={repaired}
                      completionPercent={day.completionPercent}
                    />
                    <span className="mt-2 block text-xs text-muted">
                      {day.label}
                    </span>
                    <span className="sr-only">{`${day.dateKey}: ${repaired ? "streak repaired; no check-in recorded" : day.checkedIn ? `${day.completedCount} of ${day.totalCount} completed` : "no check-in"}`}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-border bg-surface-soft" />
                No check-in
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-primary/30 bg-primary-soft" />
                Checked in
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-primary" />
                All completed
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-dashed border-primary/55 bg-primary-soft/35" />
                Repaired
              </span>
            </div>
          </Card>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <Card>
              <SectionHeading
                title="Recent check-ins"
                description="Your real check-ins, just as they happened."
              />
              <AnimatedList className="mt-6 divide-y divide-border">
                {(showAll ? history : history.slice(0, 7)).map((entry) => {
                  const summary = summarizeCheckin(entry);
                  return (
                    <AnimatedListItem
                      key={entry.id}
                      className="py-4 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-4">
                        <span className="icon-tile green">
                          <Icon name="checkin" size={19} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-medium">
                            {formatHistoryDate(entry.day)}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {summary.totalCount === 0
                              ? "You took a moment to check in."
                              : `${summary.routineCompletedCount}/${summary.routineTotalCount} routines · ${summary.taskCompletedCount}/${summary.taskTotalCount} tasks`}
                          </p>
                        </div>
                        <span className="data-text text-xs text-primary">
                          {summary.totalCount
                            ? `${summary.completionPercent}%`
                            : "✓"}
                        </span>
                      </div>
                      {summary.totalCount > 0 && (
                        <div className="mt-3 pl-14">
                          <ProgressBar
                            value={summary.completedCount}
                            max={summary.totalCount}
                          />
                        </div>
                      )}
                    </AnimatedListItem>
                  );
                })}
              </AnimatedList>
              {history.length > 7 && (
                <Button
                  className="mt-5 w-full"
                  variant="ghost"
                  onClick={() => setShowAll(!showAll)}
                  aria-expanded={showAll}
                >
                  {showAll
                    ? "Show less"
                    : `Show all ${history.length} check-ins`}
                </Button>
              )}
            </Card>
            <Card tone="accent">
              <span className="icon-tile mb-5 bg-surface">
                <Icon name="spark" />
              </span>
              <SectionHeading title="Room to return" />
              <div className="mt-4">
                <Stat value={pointBalance} label="recovery points" />
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">
                Each daily check-in earns {CHECKIN_REWARD_POINTS} points once.
                Use {STREAK_REPAIR_COST_POINTS} points to reconnect a missed day
                in your rhythm.
              </p>
              <p className="mt-3 text-sm leading-6 text-muted">
                A repaired day keeps its original history. It won’t count as a
                completed check-in.
              </p>
              <div className="mt-5 border-t border-primary/10 pt-5">
                <AnimatedList className="space-y-4">
                  {repairableDays.length === 0 ? (
                    <AnimatedListItem key="no-gaps">
                      <p className="text-sm leading-6 text-muted">
                        No gaps to repair. A missed day becomes available after
                        your next check-in.
                      </p>
                    </AnimatedListItem>
                  ) : (
                    repairableDays.map((day) => (
                      <AnimatedListItem
                        className="rounded-2xl bg-surface p-4"
                        key={day}
                      >
                        <p className="mb-3 text-sm font-medium">
                          {formatHistoryDate(day)}
                        </p>
                        <Button
                          className="w-full"
                          disabled={
                            pointBalance < STREAK_REPAIR_COST_POINTS ||
                            repairingDay !== null
                          }
                          onClick={() => repairDay(day)}
                          busy={repairingDay === day}
                        >
                          {repairingDay === day
                            ? "Repairing…"
                            : `Repair · ${STREAK_REPAIR_COST_POINTS} pts`}
                        </Button>
                      </AnimatedListItem>
                    ))
                  )}
                </AnimatedList>
                {repairableDays.length > 0 &&
                  pointBalance < STREAK_REPAIR_COST_POINTS && (
                    <p className="text-sm text-muted">
                      {STREAK_REPAIR_COST_POINTS - pointBalance} more points to
                      repair a day.
                    </p>
                  )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </PageShell>
  );
}
