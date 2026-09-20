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
import {
  currentNotificationPermission,
  disablePushNotifications,
  enablePushNotifications,
  notificationsSupported,
} from "@/lib/notifications";
import {
  allNotificationCategoriesEnabled,
  getNotificationPreference,
  removePushSubscription,
  saveNotificationPreference,
  type NotificationCategoryField,
  type NotificationPreference,
  type NotificationPreferenceUpdate,
} from "@/lib/db/notifications";

const categories: {
  field: NotificationCategoryField;
  label:
    | "reminder.tasks"
    | "reminder.routines"
    | "reminder.medication"
    | "reminder.sport"
    | "reminder.checkin";
}[] = [
  { field: "task_enabled", label: "reminder.tasks" },
  { field: "routine_enabled", label: "reminder.routines" },
  { field: "health_enabled", label: "reminder.medication" },
  { field: "workout_enabled", label: "reminder.sport" },
  { field: "checkin_enabled", label: "reminder.checkin" },
];

export function ReminderSettings({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const [preference, setPreference] = useState<NotificationPreference | null>(
    null,
  );
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [status, setStatus] = useState<
    "reminder.offDone" | "reminder.deviceOffDone" | null
  >(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  async function refresh() {
    setPreference(await getNotificationPreference(userId));
    setLoaded(true);
  }

  useEffect(() => {
    setClientReady(true);
    let cancelled = false;
    getNotificationPreference(userId)
      .then((value) => {
        if (!cancelled) {
          setPreference(value);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function setMaster(enabled: boolean) {
    if (busy) return;
    setBusy(true);
    setError(false);
    setStatus(null);

    try {
      if (enabled) {
        await enablePushNotifications(userId);
      }

      await saveNotificationPreference(userId, {
        enabled,
        prompt_seen: true,
        timezone,
        ...(preference ? {} : allNotificationCategoriesEnabled),
      });
      await refresh();
      if (!enabled) setStatus("reminder.offDone");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function setCategory(
    field: NotificationCategoryField,
    enabled: boolean,
  ) {
    if (busy) return;
    setBusy(true);
    setError(false);
    setStatus(null);

    try {
      const update: NotificationPreferenceUpdate = {
        prompt_seen: true,
        timezone,
        ...(preference ? {} : allNotificationCategoriesEnabled),
      };
      update[field] = enabled;
      await saveNotificationPreference(userId, update);
      await refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function disableDevice() {
    if (busy) return;
    setBusy(true);
    setError(false);
    setStatus(null);

    try {
      const endpoint = await disablePushNotifications();
      if (endpoint) await removePushSubscription(endpoint);
      setStatus("reminder.deviceOffDone");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const available = clientReady && notificationsSupported();
  const blocked =
    clientReady && currentNotificationPermission() === "denied";

  return (
    <Card>
      <SectionHeading
        title={t("reminder.settingsTitle")}
        description={t("reminder.settingsBody")}
      />

      {error && <ErrorNotice>{t("common.error")}</ErrorNotice>}

      {!loaded ? (
        <LoadingState label={t("common.loading")} />
      ) : (
        <div className="mt-5 space-y-5">
          {clientReady && !available && (
            <p role="status" className="notice">
              {t("reminder.unsupported")}
            </p>
          )}
          {blocked && (
            <p role="status" className="notice">
              {t("reminder.denied")}
            </p>
          )}

          <label className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4">
            <span>
              <span className="block font-medium">{t("reminder.master")}</span>
              <span className="mt-1 block text-sm text-muted">
                {t("reminder.masterBody")}
              </span>
            </span>
            <input
              type="checkbox"
              checked={Boolean(preference?.enabled)}
              disabled={busy || !available || blocked}
              onChange={(event) => void setMaster(event.target.checked)}
            />
          </label>

          <div className="space-y-2">
            {categories.map((category) => (
              <label
                key={category.field}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border px-4 py-3"
              >
                <span className="font-medium">{t(category.label)}</span>
                <input
                  type="checkbox"
                  checked={preference?.[category.field] ?? true}
                  disabled={busy}
                  onChange={(event) =>
                    void setCategory(category.field, event.target.checked)
                  }
                />
              </label>
            ))}
          </div>

          <p className="text-sm text-muted">
            {t("common.timezone")}: <bdi>{timezone}</bdi>
          </p>

          <Button disabled={busy} onClick={() => void disableDevice()}>
            {t("reminder.deviceOff")}
          </Button>

          {status && <p role="status">{t(status)}</p>}
          <p className="text-sm text-muted">{t("reminder.reliability")}</p>
        </div>
      )}
    </Card>
  );
}
