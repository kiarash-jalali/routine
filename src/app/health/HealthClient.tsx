"use client";
import { useState } from "react";
import { AnimatedList, AnimatedListItem } from "@/components/Motion";
import {
  Button,
  Card,
  ErrorNotice,
  PageHeader,
  PageShell,
  Pill,
  SectionHeading,
} from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { ReminderSetup } from "@/components/notifications/ReminderSetup";
import { MedicationForm } from "@/components/health/MedicationForm";
import { LifeLinks } from "@/components/life/LifeLinks";
import { useOwnedData } from "@/components/life/useOwnedData";
import {
  loadHealth,
  saveMedication,
  setMedicationActive,
  setMedicationTaken,
} from "@/lib/db/health";
import { localClock, reminderState } from "@/lib/schedule";
import type { MedicationPlan, MedicationReminder } from "@/types/health";
type HealthData = Awaited<ReturnType<typeof loadHealth>>;

export function HealthClient({
  userId,
  initialData,
  initialLoadError,
}: {
  userId: string;
  initialData: HealthData;
  initialLoadError: boolean;
}) {
  const { t, time, date, weekday } = useLanguage();
  const { data, error, busy, now, act, limit, more } = useOwnedData(
    loadHealth,
    userId,
    initialData,
    initialLoadError,
  );
  const [editor, setEditor] = useState<MedicationPlan | "new" | null>(null);
  const [tab, setTab] = useState<"today" | "history">("today");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const today =
    data?.reminders
      .filter((r) => r.scheduled_day === localClock(now, r.timezone).day)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)) ?? [];
  const history =
    data?.reminders.filter(
      (r) => r.scheduled_day < localClock(now, r.timezone).day,
    ) ?? [];
  function reminderRow(reminder: MedicationReminder) {
    const state = reminderState(reminder.scheduled_at, reminder.taken_at, now);
    return (
      <AnimatedListItem key={reminder.id}>
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">
              <bdi>{reminder.name}</bdi>
            </h3>
            {reminder.dose && (
              <p className="text-sm">
                <bdi>{reminder.dose}</bdi>
              </p>
            )}
            <p className="mt-1 text-sm text-muted">
              {tab === "history" && <>{date(reminder.scheduled_day)} · </>}
              {time(reminder.scheduled_time)} · <bdi>{reminder.timezone}</bdi>
            </p>
            {reminder.taken_at && (
              <p className="text-sm text-muted">
                {t("health.recorded", {
                  time: date(reminder.taken_at, {
                    dateStyle: "short",
                    timeStyle: "short",
                  }),
                })}
              </p>
            )}
            <div className="mt-2">
              <Pill>{t(`health.${state}`)}</Pill>
            </div>
          </div>
          <Button
            disabled={busy}
            onClick={() =>
              void act(() =>
                setMedicationTaken(userId, reminder.id, !reminder.taken_at),
              )
            }
          >
            {t(reminder.taken_at ? "health.undo" : "health.take")}
          </Button>
        </Card>
      </AnimatedListItem>
    );
  }
  return (
    <PageShell>
      <PageHeader
        title={t("health.title")}
        description={t("health.body")}
        actions={
          <Button
            variant="primary"
            disabled={!data}
            onClick={() => setEditor("new")}
          >
            {t("health.add")}
          </Button>
        }
      />
      <LifeLinks />
      {error && <ErrorNotice>{t("common.error")}</ErrorNotice>}
      <>
          <p className="my-5 text-sm leading-6 text-muted">
            {t("health.tracking")}
          </p>
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
              {t("health.history")}
            </Button>
          </div>
          <AnimatedList className="space-y-3">
            {(tab === "today" ? today : history).map(reminderRow)}
          </AnimatedList>
          {!(tab === "today" ? today : history).length && (
            <Card>
              <p className="text-muted">
                {t(
                  tab === "today" ? "health.todayEmpty" : "health.historyEmpty",
                )}
              </p>
            </Card>
          )}
          {tab === "history" && data.reminders.length >= limit && (
            <Button className="mt-4" onClick={more}>
              {t("schedule.more")}
            </Button>
          )}
          <div className="mt-9">
            <SectionHeading title={t("health.plans")} />
            <div className="mt-4 space-y-3">
              {data.plans.map((plan) => (
                <Card key={plan.id} tone="soft">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        <bdi>{plan.name}</bdi>{" "}
                        {plan.dose && (
                          <span className="font-normal">
                            <bdi>{plan.dose}</bdi>
                          </span>
                        )}
                      </h3>
                      <p className="mt-2 text-sm text-muted">
                        {plan.times.map(time).join(" · ")}
                      </p>
                      <p className="text-sm text-muted">
                        {plan.days_of_week
                          .map((day) => weekday(day))
                          .join(" · ")}
                      </p>
                      {plan.notes && (
                        <p className="mt-3 whitespace-pre-wrap text-sm">
                          <bdi>{plan.notes}</bdi>
                        </p>
                      )}
                      <div className="mt-3">
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
                            setMedicationActive(
                              userId,
                              plan.id,
                              !plan.is_active,
                            ),
                          )
                        }
                      >
                        {t(plan.is_active ? "common.pause" : "common.resume")}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              {!data.plans.length && <Card tone="soft">{t("health.empty")}</Card>}
            </div>
          </div>
          <Button className="mt-6" onClick={() => setNotificationOpen(true)}>
            {t("reminder.device")}
          </Button>
        </>
      <Sheet
        open={editor !== null}
        onClose={() => setEditor(null)}
        busy={busy}
        keyboardAssist
        title={t(editor === "new" ? "health.add" : "health.edit")}
        description={t("schedule.updated")}
      >
        {error && <ErrorNotice>{t("common.error")}</ErrorNotice>}
        {editor && (
          <MedicationForm
            key={editor === "new" ? "new" : editor.id}
            initial={editor === "new" ? undefined : editor}
            busy={busy}
            onSave={async (values) => {
              await act(async () => {
                await saveMedication(
                  userId,
                  values,
                  editor === "new" ? undefined : editor.id,
                );
                setEditor(null);
                if (
                  values.reminders_enabled &&
                  (editor === "new" || !editor.reminders_enabled)
                )
                  setNotificationOpen(true);
              });
            }}
          />
        )}
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
