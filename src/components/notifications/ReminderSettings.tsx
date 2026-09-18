"use client";
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  ErrorNotice,
  LoadingState,
  SectionHeading,
} from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { disablePushNotifications } from "@/lib/notifications";
import {
  getNotificationPreference,
  removePushSubscription,
  saveNotificationPreference,
  type NotificationPreference,
} from "@/lib/db/notifications";
import { ReminderSetup } from "./ReminderSetup";
export function ReminderSettings({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const [preference, setPreference] = useState<NotificationPreference | null>(
    null,
  );
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<
    "reminder.offDone" | "reminder.deviceOffDone" | null
  >(null);
  useEffect(() => {
    let cancelled = false;
    getNotificationPreference(userId)
      .then((value) => {
        if (!cancelled) {
          setPreference(value);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  async function disable(device: boolean) {
    setBusy(true);
    setError(false);
    try {
      if (device) {
        const endpoint = await disablePushNotifications();
        if (endpoint) await removePushSubscription(endpoint);
      } else if (preference) {
        await saveNotificationPreference(userId, {
          ...preference,
          enabled: false,
        });
        setPreference({ ...preference, enabled: false });
      }
      setStatus(device ? "reminder.deviceOffDone" : "reminder.offDone");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <SectionHeading title={t("reminder.settingsTitle")} />
      {error && <ErrorNotice>{t("common.error")}</ErrorNotice>}
      {!loaded ? (
        <LoadingState label={t("common.loading")} />
      ) : (
        <div className="mt-5 space-y-4">
          <ReminderSetup
            userId={userId}
            initialTime={preference?.reminder_time.slice(0, 5)}
            onDone={() => {
              void getNotificationPreference(userId)
                .then(setPreference)
                .catch(() => setError(true));
            }}
          />
          {preference?.enabled && (
            <Button disabled={busy} onClick={() => void disable(false)}>
              {t("reminder.off")}
            </Button>
          )}
          <Button disabled={busy} onClick={() => void disable(true)}>
            {t("reminder.deviceOff")}
          </Button>
          {status && <p role="status">{t(status)}</p>}
        </div>
      )}
    </Card>
  );
}
