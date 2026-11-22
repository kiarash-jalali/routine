"use client";
import { InstallAppCard } from "@/components/pwa/InstallAppCard";
import { FirstNotificationPrompt } from "@/components/notifications/FirstNotificationPrompt";
import { useLanguage } from "@/components/preferences/LanguageProvider";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { MomentPopup, MomentSource } from "@/components/MomentPopup";
import { Collapse } from "@/components/Motion";
import { Button, ErrorNotice, PageHeader, PageShell } from "@/components/ui";
import { consumeFirstRoutineSuccess } from "@/lib/firstRun";
import type { NotificationPreference } from "@/lib/db/notifications";
import { TodayContext } from "@/components/today/TodayContext";
import { TaskSheets } from "@/components/today/TaskSheets";
import { TodayStats } from "@/components/today/TodayStats";
import { DayOneCard, FirstSuccessCard } from "@/components/today/TopCards";
import { UpNextCard } from "@/components/today/UpNextCard";
import { mainSections, sideSections } from "@/components/today/sections";
import {
  useTodayState,
  type TodayInitialData,
} from "@/components/today/useTodayState";

export function DashboardClient({
  initialNotificationPreference,
  ...initialData
}: TodayInitialData & {
  initialNotificationPreference: NotificationPreference | null | undefined;
}) {
  const { t, date } = useLanguage();
  const today = useTodayState(initialData);
  const [firstSuccessRoutine, setFirstSuccessRoutine] = useState<string | null>(
    null,
  );
  const { setShowTaskForm } = today;

  useEffect(() => {
    const routineTitle = consumeFirstRoutineSuccess();
    // Reads sessionStorage/URL, which only exist after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (routineTitle) setFirstSuccessRoutine(routineTitle);

    const shortcut = new URLSearchParams(window.location.search).get("newTask");
    if (shortcut === "1") {
      setShowTaskForm(true);
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("newTask");
      window.history.replaceState(
        window.history.state,
        "",
        cleanUrl.pathname + cleanUrl.search + cleanUrl.hash,
      );
    }
  }, [setShowTaskForm]);

  return (
    <TodayContext value={today}>
      <PageShell>
        <FirstNotificationPrompt
          userId={initialData.userId}
          initialPreference={initialNotificationPreference}
        />
        <PageHeader
          eyebrow={date(today.today, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          title={t("nav.today")}
          description={t("product.todayBody")}
          actions={
            <MomentSource id="add-task">
              <Button
                className="moment-shine"
                variant="primary"
                onClick={today.openTaskForm}
              >
                <Icon name="plus" size={18} />
                {t("product.addTask")}
              </Button>
            </MomentSource>
          }
        />
        <InstallAppCard deferUntilReturn />
        <FirstSuccessCard
          routineTitle={firstSuccessRoutine}
          onDismiss={() => setFirstSuccessRoutine(null)}
        />
        <DayOneCard />
        <Collapse show={!!today.error}>
          <div className="mb-6">
            <ErrorNotice>{today.error}</ErrorNotice>
          </div>
        </Collapse>
        <UpNextCard />
        <TodayStats />
        <div className="dashboard-main-grid grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            {mainSections.map(({ id, Component }) => (
              <Component key={id} />
            ))}
          </div>
          <div className="dashboard-side space-y-6">
            {sideSections.map(({ id, Component }) => (
              <Component key={id} />
            ))}
          </div>
        </div>

        <MomentPopup notice={today.moment} onDismiss={() => today.setMoment(null)} />

        <TaskSheets />
      </PageShell>
    </TodayContext>
  );
}
