"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import {
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  PageShell,
  ProgressBar,
  SectionHeading,
  Stat,
} from "@/components/ui";
import { listRecentCheckinHistory } from "@/lib/db/history";
import { getErrorMessage } from "@/lib/errors";
import {
  averageCompletionPercent,
  buildRhythmDays,
  countRecentCheckins,
  formatHistoryDate,
  summarizeCheckin,
} from "@/lib/history";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { CheckinHistoryEntry } from "@/types/history";

function RhythmCell({
  checkedIn,
  completionPercent,
}: {
  checkedIn: boolean;
  completionPercent: number;
}) {
  const className = checkedIn
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

        const recentHistory = await listRecentCheckinHistory(user.id, 30);
        if (!cancelled) setHistory(recentHistory);
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

  const rhythmDays = useMemo(() => buildRhythmDays(history, 14), [history]);
  const checkedInLastSeven = useMemo(
    () => countRecentCheckins(history, 7),
    [history],
  );
  const averageCompletion = useMemo(
    () => averageCompletionPercent(history),
    [history],
  );

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
          <div className="grid gap-3 sm:grid-cols-3">
            <Card tone="accent" className="p-4 sm:p-5">
              <Stat value={`${checkedInLastSeven}/7`} label="days checked in lately" />
            </Card>
            <Card tone="soft" className="p-4 sm:p-5">
              <Stat value={`${averageCompletion}%`} label="average completion" />
            </Card>
            <Card tone="soft" className="p-4 sm:p-5">
              <Stat value={history.length} label="recent check-ins recorded" />
            </Card>
          </div>

          <Card>
            <SectionHeading
              title="Last 14 days"
              description="Filled days are days you checked in. Stronger fill means everything on that check-in was completed."
            />

            <div className="mt-5 grid grid-cols-7 gap-2 sm:grid-cols-[repeat(14,minmax(0,1fr))]">
              {rhythmDays.map((day) => (
                <div key={day.dateKey} className="min-w-0 text-center">
                  <RhythmCell
                    checkedIn={day.checkedIn}
                    completionPercent={day.completionPercent}
                  />
                  <span className="mt-1.5 block text-[11px] text-muted">
                    {day.label}
                  </span>
                  <span className="sr-only">
                    {`${day.dateKey}: ${
                      day.checkedIn
                        ? `${day.completedCount} of ${day.totalCount} completed`
                        : "no check-in"
                    }`}
                  </span>
                </div>
              ))}
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
            </div>
          </Card>

          <Card>
            <SectionHeading
              title="Recent check-ins"
              description="Your most recent 30 daily check-ins."
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
