"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Button, Card, ErrorNotice, SectionHeading } from "@/components/ui";
import { changeTimeHref, type AdaptiveCategory } from "@/lib/adaptiveReminders";
import { keepReminders, pauseReminders, restartReminders } from "@/lib/db/reminderAdaptations";
import { useTodayContext } from "./TodayContext";

/** One unopened reminder category at a time, so this stays one small question (S7b). */
export function QuietRemindersCard() {
  const { t } = useLanguage();
  const router = useRouter();
  const { userId, quietReminders, dismissQuietReminder } = useTodayContext();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const category = quietReminders[0];
  if (!category) return null;

  const href = changeTimeHref(category);

  async function run(
    current: AdaptiveCategory,
    action: (userId: string, category: AdaptiveCategory) => Promise<void>,
    goTo?: string,
  ) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await action(userId, current);
      dismissQuietReminder(current);
      if (goTo) router.push(goTo);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card tone="soft">
      <SectionHeading
        title={t("quietReminders.title")}
        description={t("quietReminders.body", { name: t(`quietReminders.${category}`) })}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void run(category, keepReminders)}>
          {t("quietReminders.keep")}
        </Button>
        {href && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void run(category, restartReminders, href)}
          >
            {t("quietReminders.changeTime")}
          </Button>
        )}
        <Button variant="ghost" disabled={busy} onClick={() => void run(category, pauseReminders)}>
          {t("quietReminders.pause")}
        </Button>
      </div>
      {failed && (
        <div className="mt-3">
          <ErrorNotice>{t("common.error")}</ErrorNotice>
        </div>
      )}
    </Card>
  );
}
