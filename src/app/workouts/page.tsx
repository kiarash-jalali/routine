"use client";
import { useState } from "react";
import { AnimatedList, AnimatedListItem } from "@/components/Motion";
import {
  Button,
  Card,
  ErrorNotice,
  Input,
  LoadingState,
  PageHeader,
  PageShell,
  Pill,
  SectionHeading,
} from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { ReminderSetup } from "@/components/notifications/ReminderSetup";
import { WorkoutForm } from "@/components/workouts/WorkoutForm";
import { LifeLinks } from "@/components/life/LifeLinks";
import { useOwnedData } from "@/components/life/useOwnedData";
import {
  completeWorkout,
  loadWorkouts,
  logWorkout,
  saveWorkout,
  setWorkoutActive,
} from "@/lib/db/workouts";
import { localClock } from "@/lib/schedule";
import type { WorkoutPlan, WorkoutSession } from "@/types/workout";
export default function WorkoutsPage() {
  const { t, date, time, number, weekday } = useLanguage();
  const { userId, data, error, busy, now, act, limit, more } =
    useOwnedData(loadWorkouts);
  const [editor, setEditor] = useState<WorkoutPlan | "new" | "log" | null>(
    null,
  );
  const [tab, setTab] = useState<"today" | "history">("today");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [completion, setCompletion] = useState<WorkoutSession | null>(null);
  const [duration, setDuration] = useState(30);
  const rows =
    data?.sessions.filter((s) =>
      tab === "today"
        ? s.scheduled_day === localClock(now, s.timezone).day
        : s.completed_at || s.scheduled_day < localClock(now, s.timezone).day,
    ) ?? [];
  return (
    <PageShell>
      <PageHeader
        title={t("workout.title")}
        description={t("workout.body")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button disabled={!data} onClick={() => setEditor("log")}>
              {t("workout.log")}
            </Button>
            <Button
              disabled={!data}
              variant="primary"
              onClick={() => setEditor("new")}
            >
              {t("workout.add")}
            </Button>
          </div>
        }
      />
      <LifeLinks />
      {error && <ErrorNotice>{t("common.error")}</ErrorNotice>}
      {!data ? (
        !error && <LoadingState label={t("common.loading")} />
      ) : (
        <>
          <div className="mb-5 flex gap-3">
            <Button
              aria-pressed={tab === "today"}
              onClick={() => setTab("today")}
            >
              {t("common.today")}
            </Button>
            <Button
              aria-pressed={tab === "history"}
              onClick={() => setTab("history")}
            >
              {t("common.history")}
            </Button>
          </div>
          <AnimatedList className="space-y-3">
            {rows.map((session) => (
              <AnimatedListItem key={session.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">
                        <bdi>{session.name}</bdi>
                      </h3>
                      <p className="mt-1 text-sm text-muted">
                        <bdi>{session.activity_type}</bdi> ·{" "}
                        {t("workout.minutes", {
                          count: number(session.duration_minutes),
                        })}
                      </p>
                      <p className="text-sm text-muted">
                        {date(session.scheduled_day)} ·{" "}
                        {time(session.scheduled_time)} ·{" "}
                        <bdi>{session.timezone}</bdi>
                      </p>
                      <div className="mt-2">
                        <Pill>
                          {t(
                            session.completed_at
                              ? "workout.completed"
                              : new Date(session.scheduled_at) <= now
                                ? "workout.missed"
                                : "workout.upcoming",
                          )}
                        </Pill>
                      </div>
                    </div>
                    <Button
                      disabled={busy}
                      onClick={() => {
                        if (session.completed_at)
                          void act(() =>
                            completeWorkout(
                              userId,
                              session.id,
                              false,
                              session.duration_minutes,
                            ),
                          );
                        else {
                          setCompletion(session);
                          setDuration(session.duration_minutes);
                        }
                      }}
                    >
                      {t(
                        session.completed_at
                          ? "workout.undo"
                          : "workout.complete",
                      )}
                    </Button>
                  </div>
                  {session.exercises && (
                    <p className="mt-4 whitespace-pre-wrap text-sm text-muted">
                      <bdi>{session.exercises}</bdi>
                    </p>
                  )}
                </Card>
              </AnimatedListItem>
            ))}
          </AnimatedList>
          {!rows.length && (
            <Card>
              {t(
                tab === "today" ? "workout.todayEmpty" : "workout.historyEmpty",
              )}
            </Card>
          )}
          {tab === "history" && data.sessions.length >= limit && (
            <Button className="mt-4" onClick={more}>
              {t("schedule.more")}
            </Button>
          )}
          <div className="mt-9">
            <SectionHeading title={t("workout.plans")} />
            <div className="mt-4 space-y-3">
              {data.plans.map((plan) => (
                <Card key={plan.id}>
                  <div className="flex flex-wrap justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">
                        <bdi>{plan.name}</bdi>
                      </h3>
                      <p className="mt-2 text-sm text-muted">
                        {plan.days_of_week
                          .map((day) => weekday(day))
                          .join(" · ")}{" "}
                        · {time(plan.preferred_time)}
                      </p>
                      <p className="text-sm text-muted">
                        <bdi>{plan.activity_type}</bdi> ·{" "}
                        {t("workout.minutes", {
                          count: number(plan.duration_minutes),
                        })}
                      </p>
                      <div className="mt-2">
                        <Pill>
                          {t(
                            plan.is_active ? "common.active" : "common.paused",
                          )}
                        </Pill>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Button disabled={busy} onClick={() => setEditor(plan)}>
                        {t("common.edit")}
                      </Button>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void act(() =>
                            setWorkoutActive(userId, plan.id, !plan.is_active),
                          )
                        }
                      >
                        {t(plan.is_active ? "common.pause" : "common.resume")}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              {!data.plans.length && <Card>{t("workout.empty")}</Card>}
            </div>
          </div>
          <Button className="mt-6" onClick={() => setNotificationOpen(true)}>
            {t("reminder.device")}
          </Button>
        </>
      )}
      <Sheet
        open={editor !== null}
        busy={busy}
        keyboardAssist
        onClose={() => setEditor(null)}
        title={t(
          editor === "log"
            ? "workout.log"
            : editor === "new"
              ? "workout.add"
              : "workout.edit",
        )}
        description={t("schedule.updated")}
      >
        {error && <ErrorNotice>{t("common.error")}</ErrorNotice>}
        {editor && (
          <WorkoutForm
            key={typeof editor === "string" ? editor : editor.id}
            initial={typeof editor === "object" ? editor : undefined}
            busy={busy}
            onLog={
              editor === "log"
                ? async (values) => {
                    await act(async () => {
                      await logWorkout(userId, values);
                      setEditor(null);
                    });
                  }
                : undefined
            }
            onSave={async (values) => {
              await act(async () => {
                await saveWorkout(
                  userId,
                  values,
                  typeof editor === "object" ? editor.id : undefined,
                );
                setEditor(null);
                if (
                  values.reminders_enabled &&
                  (typeof editor === "string" || !editor.reminders_enabled)
                )
                  setNotificationOpen(true);
              });
            }}
          />
        )}
      </Sheet>
      <Sheet
        open={!!completion}
        busy={busy}
        onClose={() => setCompletion(null)}
        title={t("workout.actual")}
      >
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (completion)
              void act(async () => {
                await completeWorkout(userId, completion.id, true, duration);
                setCompletion(null);
              });
          }}
        >
          {error && <ErrorNotice>{t("common.error")}</ErrorNotice>}
          <label className="grid gap-2 text-sm">
            {t("workout.duration")}
            <Input
              type="number"
              min={1}
              max={1440}
              step={1}
              required
              value={duration || ""}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </label>
          <Button type="submit" disabled={busy} busy={busy} variant="primary">
            {t("workout.complete")}
          </Button>
        </form>
      </Sheet>
      <Sheet
        open={notificationOpen}
        onClose={() => setNotificationOpen(false)}
        title={t("reminder.device")}
      >
        <div className="mt-5">
          <ReminderSetup
            userId={userId}
            deviceOnly
            onDone={() => setNotificationOpen(false)}
          />
          <Button className="mt-4" onClick={() => setNotificationOpen(false)}>
            {t("common.done")}
          </Button>
        </div>
      </Sheet>
    </PageShell>
  );
}
