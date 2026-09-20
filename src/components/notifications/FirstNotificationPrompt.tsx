"use client";

import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button, ErrorNotice } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import {
  allNotificationCategoriesEnabled,
  saveNotificationPreference,
  type NotificationPreference,
} from "@/lib/db/notifications";
import {
  currentNotificationPermission,
  enablePushNotifications,
  notificationsSupported,
} from "@/lib/notifications";

export function FirstNotificationPrompt({
  userId,
  initialPreference,
}: {
  userId: string;
  initialPreference: NotificationPreference | null | undefined;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(
    initialPreference === null && notificationsSupported(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  async function remember(enabled: boolean) {
    await saveNotificationPreference(userId, {
      enabled,
      prompt_seen: true,
      timezone,
      ...allNotificationCategoriesEnabled,
    });
  }

  async function allow() {
    if (busy) return;
    setBusy(true);
    setError(false);

    try {
      await enablePushNotifications(userId);
      await remember(true);
      setOpen(false);
    } catch {
      setError(true);
      if (currentNotificationPermission() === "denied") {
        await remember(false).catch(() => undefined);
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function notNow() {
    if (busy) return;
    setBusy(true);
    setError(false);

    try {
      await remember(false);
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => void notNow()}
      title={t("reminder.firstTitle")}
      description={t("reminder.firstBody")}
      busy={busy}
      compact
    >
      <div className="mt-6 space-y-4">
        {error && <ErrorNotice>{t("reminder.failed")}</ErrorNotice>}
        <Button
          className="w-full"
          variant="primary"
          busy={busy}
          disabled={busy}
          onClick={() => void allow()}
        >
          {t("reminder.allowAll")}
        </Button>
        <Button
          className="w-full"
          disabled={busy}
          onClick={() => void notNow()}
        >
          {t("reminder.notNow")}
        </Button>
      </div>
    </Sheet>
  );
}
