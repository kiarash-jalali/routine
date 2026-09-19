"use client";
import { useEffect, useState } from "react";
import { Button, ErrorNotice, Input } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import {
  currentNotificationPermission,
  enablePushNotifications,
  notificationsSupported,
  iosPushRequiresInstall,
  showNotificationTest,
} from "@/lib/notifications";
import {
  saveNotificationPreference,
  savePushSubscription,
} from "@/lib/db/notifications";
export function ReminderSetup({
  userId,
  initialTime = "20:00",
  onDone,
  deviceOnly = false,
}: {
  userId: string;
  initialTime?: string;
  onDone?: () => void;
  deviceOnly?: boolean;
}) {
  const { t, language } = useLanguage();
  const [time, setTime] = useState(initialTime);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [permission, setPermission] = useState(currentNotificationPermission);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  useEffect(() => {
    const refresh = () => setPermission(currentNotificationPermission());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  async function enable() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      // Call permission directly from this click; iOS requires a user gesture.
      const { storedSubscription } = await enablePushNotifications();
      await savePushSubscription(userId, storedSubscription);
      if (!deviceOnly)
        await saveNotificationPreference(userId, {
          enabled: true,
          reminder_time: time,
          timezone,
        });
      setSuccess(true);
      await showNotificationTest(language).catch(() => undefined);
      onDone?.();
    } catch {
      setError(true);
    } finally {
      setPermission(currentNotificationPermission());
      setBusy(false);
    }
  }
  const available = notificationsSupported();
  const needsIosInstall = iosPushRequiresInstall();
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted">
        {t(deviceOnly ? "reminder.deviceBody" : "reminder.body")}
      </p>
      {!deviceOnly && (
        <label className="grid gap-2 text-sm">
          {t("reminder.time")}
          <Input
            type="time"
            required
            value={time}
            disabled={busy}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
      )}
      <p className="text-sm text-muted">
        {t("common.timezone")}: <bdi>{timezone}</bdi>
      </p>
      {!available && (
        <p role="status" className="notice">
          {t(needsIosInstall ? "reminder.iosInstall" : "reminder.unsupported")}
        </p>
      )}
      {permission === "denied" && (
        <p role="status" className="notice">
          {t("reminder.denied")}
        </p>
      )}
      {error && permission !== "denied" && (
        <ErrorNotice>
          {t(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
              ? "reminder.failed"
              : "reminder.unconfigured",
          )}
        </ErrorNotice>
      )}
      {success && <p role="status">{t("reminder.enabled")}</p>}
      {available && (
        <>
          <p className="text-sm text-muted">{t("reminder.permission")}</p>
          <Button
            variant="primary"
            busy={busy}
            disabled={busy || !time || permission === "denied"}
            onClick={enable}
          >
            {t("reminder.enable")}
          </Button>
        </>
      )}
      <p className="text-sm text-muted">{t("reminder.reliability")}</p>
    </div>
  );
}
