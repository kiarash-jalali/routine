"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  ErrorNotice,
  Input,
  LoadingState,
  Select,
  SectionHeading,
} from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import {
  currentNotificationPermission,
  disablePushNotifications,
  enablePushNotifications,
  notificationsSupported,
} from "@/lib/notifications";
import { defaultWeekStart } from "@/lib/nutrition/body";
import { getWeekStartsOn } from "@/lib/db/mealPlan";
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
  const { t, language, weekday } = useLanguage();
  const [preference, setPreference] = useState<NotificationPreference | null>(
    null,
  );
  const [loaded, setLoaded] = useState(false);
  // The user's week start (body profile, else language) sets the default days.
  const [weekStartsOn, setWeekStartsOn] = useState<number | null>(null);
  const [timeDrafts, setTimeDrafts] = useState<Record<string, string>>({});
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
    // Hydration flag: browser-only controls render after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    getWeekStartsOn(userId, language)
      .then((value) => {
        if (!cancelled) setWeekStartsOn(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId, language]);

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

  async function setWeekly(kind: "meal_plan" | "grocery", values: {
    enabled?: boolean;
    dow?: number;
    time?: string;
  }) {
    if (busy) return;
    setBusy(true);
    setError(false);
    setStatus(null);
    // Defaults: plan the day before the week starts at 18:00, shop the same day at 19:00.
    const planDay = defaultReminderDay;
    const current = {
      enabled: preference?.[`${kind}_enabled`] ?? false,
      dow: preference?.[`${kind}_dow`] ?? planDay,
      time: preference?.[`${kind}_time`]?.slice(0, 5) ?? (kind === "meal_plan" ? "18:00" : "19:00"),
    };
    const next = { ...current, ...values };
    try {
      await saveNotificationPreference(userId, {
        prompt_seen: true,
        timezone,
        ...(preference ? {} : allNotificationCategoriesEnabled),
        ...(kind === "meal_plan"
          ? { meal_plan_enabled: next.enabled, meal_plan_dow: next.dow, meal_plan_time: next.time }
          : { grocery_enabled: next.enabled, grocery_dow: next.dow, grocery_time: next.time }),
      });
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

  // Defaults: plan the day before the week starts.
  const defaultReminderDay = ((weekStartsOn ?? defaultWeekStart(language)) + 6) % 7;
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

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4">
            <div>
              <label htmlFor="notification-master" className="block font-medium">
                {t("reminder.master")}
              </label>
              <p className="mt-1 text-sm text-muted">
                {t("reminder.masterBody")}
              </p>
            </div>
            <input
              id="notification-master"
              type="checkbox"
              checked={Boolean(preference?.enabled)}
              disabled={busy || !available || blocked}
              onChange={(event) => void setMaster(event.target.checked)}
            />
          </div>

          <div className="space-y-2">
            {categories.map((category) => {
              const inputId = `notification-${category.field}`;
              return (
                <div
                  key={category.field}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border px-4 py-3"
                >
                  <label htmlFor={inputId} className="font-medium">
                    {t(category.label)}
                  </label>
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={preference?.[category.field] ?? true}
                    disabled={busy}
                    onChange={(event) =>
                      void setCategory(category.field, event.target.checked)
                    }
                  />
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            {(["meal_plan", "grocery"] as const).map((kind) => {
              const inputId = `notification-${kind}`;
              const enabled = preference?.[`${kind}_enabled`] ?? false;
              const dow = preference?.[`${kind}_dow`] ?? defaultReminderDay;
              const savedTime =
                preference?.[`${kind}_time`]?.slice(0, 5) ?? (kind === "meal_plan" ? "18:00" : "19:00");
              const time = timeDrafts[kind] ?? savedTime;
              return (
                <div key={kind} className="space-y-3 rounded-2xl border border-border px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <label htmlFor={inputId} className="font-medium">
                      {t(kind === "meal_plan" ? "reminder.mealPlan" : "reminder.grocery")}
                    </label>
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={enabled}
                      disabled={busy}
                      onChange={(event) => void setWeekly(kind, { enabled: event.target.checked })}
                    />
                  </div>
                  {enabled && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1 text-sm">
                        <span>{t("reminder.weeklyDay")}</span>
                        <Select
                          value={String(dow)}
                          disabled={busy}
                          onChange={(event) => void setWeekly(kind, { dow: Number(event.target.value) })}
                        >
                          {[0, 1, 2, 3, 4, 5, 6].map((value) => (
                            <option key={value} value={value}>
                              {weekday(value, "long")}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="block space-y-1 text-sm">
                        <span>{t("reminder.weeklyTime")}</span>
                        <Input
                          type="time"
                          value={time}
                          disabled={busy}
                          onChange={(event) =>
                            setTimeDrafts((drafts) => ({ ...drafts, [kind]: event.target.value }))
                          }
                          // Saved when the field is left, not on every keystroke.
                          onBlur={() => {
                            if (busy) return; // keep the draft until it can be saved
                            setTimeDrafts((drafts) => {
                              const rest = { ...drafts };
                              delete rest[kind];
                              return rest;
                            });
                            if (/^\d{2}:\d{2}$/.test(time) && time !== savedTime) {
                              void setWeekly(kind, { time });
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
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
