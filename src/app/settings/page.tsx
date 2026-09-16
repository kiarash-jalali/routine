"use client";

import { useEffect, useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Button,
  Card,
  ErrorNotice,
  Input,
  LoadingState,
  PageHeader,
  PageShell,
  SectionHeading,
} from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";
import {
  getNotificationPreference,
  removePushSubscription,
  saveNotificationPreference,
  savePushSubscription,
} from "@/lib/db/notifications";
import { getProfile, saveDisplayName } from "@/lib/db/profile";
import { getErrorMessage } from "@/lib/errors";
import {
  currentNotificationPermission,
  disablePushNotifications,
  enablePushNotifications,
  notificationsSupported,
  showNotificationTest,
} from "@/lib/notifications";
import { supabaseBrowser } from "@/lib/supabaseClient";

function getDeviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("20:00");
  const [reminderTimeZone, setReminderTimeZone] = useState("UTC");
  const [notificationPermission, setNotificationPermission] = useState<
    "default" | "denied" | "granted" | "unsupported"
  >("unsupported");
  const [busyAction, setBusyAction] = useState<
    | "profile"
    | "email"
    | "password"
    | "notifications"
    | "logout"
    | "delete"
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const supabase = supabaseBrowser();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        const profile = await getProfile(user.id);
        if (cancelled) return;

        setUserId(user.id);
        setDisplayName(profile?.display_name ?? "");
        setEmail(user.email ?? "");
        setNewEmail(user.email ?? "");
        setReminderTimeZone(getDeviceTimeZone());
        setNotificationPermission(currentNotificationPermission());

        // Notification storage is a newer migration. Keep the rest of Settings
        // usable even before that migration has been applied locally.
        try {
          const preference = await getNotificationPreference(user.id);
          if (!cancelled && preference) {
            setReminderEnabled(preference.enabled);
            setReminderTime(preference.reminder_time.slice(0, 5));
            setReminderTimeZone(preference.timezone || getDeviceTimeZone());
          }
        } catch {
          // The notification card will surface setup errors when the user tries
          // to enable it; existing account settings should still load normally.
        }
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Settings could not be loaded."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function beginAction(action: typeof busyAction) {
    setBusyAction(action);
    setError(null);
    setNotice(null);
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!userId || !displayName.trim() || busyAction) return;

    beginAction("profile");
    try {
      await saveDisplayName(userId, displayName);
      setDisplayName(displayName.trim());
      setNotice("Profile updated.");
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, "Your profile could not be updated."));
    } finally {
      setBusyAction(null);
    }
  }

  async function updateEmail(event: React.FormEvent) {
    event.preventDefault();
    const nextEmail = newEmail.trim();
    if (!nextEmail || nextEmail === email || busyAction) return;

    beginAction("email");
    try {
      const { data, error: updateError } = await supabaseBrowser().auth.updateUser({
        email: nextEmail,
      });
      if (updateError) throw updateError;

      const currentEmail = data.user.email ?? nextEmail;
      setEmail(currentEmail);
      setNewEmail(currentEmail);
      setNotice(
        currentEmail === nextEmail
          ? "Email updated."
          : "Email change requested. Check your inbox if confirmation is required.",
      );
    } catch (updateError: unknown) {
      setError(getErrorMessage(updateError, "Your email could not be updated."));
    } finally {
      setBusyAction(null);
    }
  }

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    if (busyAction) return;

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(
        `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      setNotice(null);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The two password fields do not match.");
      setNotice(null);
      return;
    }

    beginAction("password");
    try {
      const { error: updateError } = await supabaseBrowser().auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      setNewPassword("");
      setConfirmPassword("");
      setNotice("Password updated.");
    } catch (updateError: unknown) {
      setError(getErrorMessage(updateError, "Your password could not be updated."));
    } finally {
      setBusyAction(null);
    }
  }

  async function enableReminder() {
    if (!userId || busyAction) return;
    beginAction("notifications");

    try {
      const timeZone = getDeviceTimeZone();
      const { storedSubscription } = await enablePushNotifications();
      await savePushSubscription(userId, storedSubscription);
      await saveNotificationPreference(userId, {
        enabled: true,
        reminder_time: reminderTime,
        timezone: timeZone,
      });

      setReminderEnabled(true);
      setReminderTimeZone(timeZone);
      setNotificationPermission("granted");
      await showNotificationTest();
      setNotice("Daily check-in reminder enabled on this device.");
    } catch (notificationError: unknown) {
      setNotificationPermission(currentNotificationPermission());
      setError(
        getErrorMessage(notificationError, "Notifications could not be enabled."),
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function saveReminderSchedule(event: React.FormEvent) {
    event.preventDefault();
    if (!userId || !reminderEnabled || busyAction) return;
    beginAction("notifications");

    try {
      const timeZone = getDeviceTimeZone();
      await saveNotificationPreference(userId, {
        enabled: true,
        reminder_time: reminderTime,
        timezone: timeZone,
      });
      setReminderTimeZone(timeZone);
      setNotice(`Reminder time saved for ${reminderTime}.`);
    } catch (notificationError: unknown) {
      setError(
        getErrorMessage(notificationError, "The reminder time could not be saved."),
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function disableReminder() {
    if (!userId || busyAction) return;
    beginAction("notifications");

    try {
      const endpoint = await disablePushNotifications();
      if (endpoint) await removePushSubscription(endpoint);
      await saveNotificationPreference(userId, {
        enabled: false,
        reminder_time: reminderTime,
        timezone: getDeviceTimeZone(),
      });
      setReminderEnabled(false);
      setNotificationPermission(currentNotificationPermission());
      setNotice("Daily reminder turned off.");
    } catch (notificationError: unknown) {
      setError(
        getErrorMessage(notificationError, "The reminder could not be turned off."),
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function logout() {
    if (busyAction) return;
    beginAction("logout");
    try {
      const { error: logoutError } = await supabaseBrowser().auth.signOut();
      if (logoutError) throw logoutError;
      router.replace("/login");
    } catch (logoutError: unknown) {
      setError(getErrorMessage(logoutError, "Could not log out."));
      setBusyAction(null);
    }
  }

  async function deleteAccount() {
    if (deleteConfirmation !== "DELETE" || busyAction) return;

    beginAction("delete");
    try {
      const supabase = supabaseBrowser();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) {
        throw new Error("Your session has expired. Log in again.");
      }

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Your account could not be deleted.");
      }

      await supabase.auth.signOut({ scope: "local" });
      router.replace("/login");
    } catch (deleteError: unknown) {
      setError(getErrorMessage(deleteError, "Your account could not be deleted."));
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <LoadingState label="Loading settings…" />
      </PageShell>
    );
  }

  const notificationAvailable = notificationsSupported();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Your space"
        title="Settings"
        description="Keep the account simple and make Routine feel like yours."
      />

      {(error || notice) && (
        <div className="mb-6" aria-live="polite">
          {error ? (
            <ErrorNotice>{error}</ErrorNotice>
          ) : (
            <div className="notice rounded-2xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground">
              {notice}
            </div>
          )}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <SectionHeading
              title="Profile"
              description="The name Routine uses when it speaks to you."
            />
            <form className="mt-6 space-y-5" onSubmit={saveProfile}>
              <label className="grid gap-2 text-sm font-medium">
                Display name
                <Input
                  value={displayName}
                  maxLength={80}
                  autoComplete="name"
                  disabled={Boolean(busyAction)}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
              <Button
                type="submit"
                variant="primary"
                disabled={Boolean(busyAction) || !displayName.trim()}
                busy={busyAction === "profile"}
              >
                Save profile
              </Button>
            </form>
          </Card>

          <Card>
            <SectionHeading
              title="Email"
              description="Used to sign in to your account."
            />
            <form className="mt-6 space-y-5" onSubmit={updateEmail}>
              <label className="grid gap-2 text-sm font-medium">
                Email address
                <Input
                  type="email"
                  value={newEmail}
                  autoComplete="email"
                  disabled={Boolean(busyAction)}
                  onChange={(event) => setNewEmail(event.target.value)}
                />
              </label>
              <Button
                type="submit"
                disabled={
                  Boolean(busyAction) ||
                  !newEmail.trim() ||
                  newEmail.trim() === email
                }
                busy={busyAction === "email"}
              >
                Update email
              </Button>
            </form>
          </Card>

          <Card>
            <SectionHeading
              title="Password"
              description={`Choose a new password with at least ${MIN_PASSWORD_LENGTH} characters.`}
            />
            <form className="mt-6 space-y-5" onSubmit={updatePassword}>
              <label className="grid gap-2 text-sm font-medium">
                New password
                <Input
                  type="password"
                  minLength={MIN_PASSWORD_LENGTH}
                  value={newPassword}
                  autoComplete="new-password"
                  disabled={Boolean(busyAction)}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Confirm new password
                <Input
                  type="password"
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirmPassword}
                  autoComplete="new-password"
                  disabled={Boolean(busyAction)}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <Button
                type="submit"
                disabled={
                  Boolean(busyAction) ||
                  !newPassword ||
                  !confirmPassword
                }
                busy={busyAction === "password"}
              >
                Change password
              </Button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionHeading
              title="Appearance"
              description="Switch between the daylight and evening palettes."
            />
            <div className="mt-6 max-w-sm">
              <ThemeToggle />
            </div>
          </Card>

          <Card>
            <SectionHeading
              title="Daily check-in reminder"
              description="One gentle notification at a time you choose. If you already checked in that day, Routine stays quiet."
            />
            <form className="mt-6 space-y-4" onSubmit={saveReminderSchedule}>
              <label className="grid gap-2 text-sm font-medium">
                Reminder time
                <Input
                  type="time"
                  value={reminderTime}
                  disabled={Boolean(busyAction)}
                  onChange={(event) => setReminderTime(event.target.value)}
                />
              </label>
              <p className="text-sm leading-6 text-muted">
                Device timezone: {reminderTimeZone}. Permission:{" "}
                {notificationPermission}.
              </p>
              {!notificationAvailable ? (
                <p className="text-sm leading-6 text-muted">
                  Push notifications are not available in this browser. On iPhone,
                  open the installed Home Screen app.
                </p>
              ) : reminderEnabled ? (
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={Boolean(busyAction) || !reminderTime}
                    busy={busyAction === "notifications"}
                  >
                    Save reminder time
                  </Button>
                  <Button
                    type="button"
                    onClick={disableReminder}
                    disabled={Boolean(busyAction)}
                  >
                    Turn off
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  onClick={enableReminder}
                  disabled={Boolean(busyAction) || !reminderTime}
                  busy={busyAction === "notifications"}
                >
                  Enable reminders
                </Button>
              )}
            </form>
          </Card>

          <Card>
            <SectionHeading
              title="Session"
              description="Sign out on this device when you are finished."
            />
            <Button
              className="mt-6"
              onClick={logout}
              disabled={Boolean(busyAction)}
              busy={busyAction === "logout"}
            >
              <Icon name="logout" size={17} />
              Log out
            </Button>
          </Card>

          <Card className="border-danger-border">
            <SectionHeading
              title="Delete account"
              description="Permanently remove your Routine account. This cannot be undone."
            />
            <div className="mt-6 space-y-4">
              <p className="text-sm leading-6 text-muted">
                Type <span className="font-semibold text-danger">DELETE</span> to
                confirm.
              </p>
              <Input
                value={deleteConfirmation}
                placeholder="DELETE"
                autoComplete="off"
                disabled={Boolean(busyAction)}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
              <Button
                variant="danger"
                onClick={deleteAccount}
                disabled={
                  Boolean(busyAction) || deleteConfirmation !== "DELETE"
                }
                busy={busyAction === "delete"}
              >
                <Icon name="trash" size={17} />
                Delete my account
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
