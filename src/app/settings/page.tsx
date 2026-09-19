"use client";

import { useEffect, useState } from "react";
import { Link, useTransitionRouter as useRouter } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import {
  MomentPopup,
  MomentSource,
  type MomentNotice,
} from "@/components/MomentPopup";
import { ThemePicker } from "@/components/preferences/ThemePicker";
import { LanguagePicker } from "@/components/preferences/LanguagePicker";
import { useLanguage } from "@/components/preferences/LanguageProvider";
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
import { ReminderSettings } from "@/components/notifications/ReminderSettings";
import { InstallAppCard } from "@/components/pwa/InstallAppCard";
import { getProfile, saveDisplayName } from "@/lib/db/profile";
import { getErrorMessage } from "@/lib/errors";
import { getMomentCopy, type MomentCopyKey } from "@/lib/moments";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { getSessionUser } from "@/lib/session";

export default function SettingsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [busyAction, setBusyAction] = useState<
    | "profile"
    | "email"
    | "password"
    | "notifications"
    | "logout"
    | "export"
    | "delete"
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [moment, setMoment] = useState<MomentNotice | null>(null);

  function showMoment(
    key: MomentCopyKey,
    sourceId: string,
    icon: MomentNotice["icon"],
    detailOverride?: string,
  ) {
    const copy = getMomentCopy(key);
    setMoment({
      id: `${key}-${Date.now()}`,
      ...copy,
      detail: detailOverride ?? copy.detail,
      sourceId,
      icon,
      tone: "success",
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const user = await getSessionUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const profile = await getProfile(user.id);
        if (cancelled) return;

        setUserId(user.id);
        setDisplayName(profile?.display_name ?? "");
        setEmail(user.email ?? "");
        setNewEmail(user.email ?? "");
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, t("settings.loadError")));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [router, t]);

  function beginAction(action: typeof busyAction) {
    setBusyAction(action);
    setError(null);
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!userId || !displayName.trim() || busyAction) return;

    beginAction("profile");
    try {
      await saveDisplayName(userId, displayName);
      setDisplayName(displayName.trim());
      showMoment("profile_saved", "settings-profile", "check");
    } catch (saveError: unknown) {
      setError(
        getErrorMessage(saveError, t("settings.profileError")),
      );
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
      const { data, error: updateError } =
        await supabaseBrowser().auth.updateUser({
          email: nextEmail,
        });
      if (updateError) throw updateError;

      const currentEmail = data.user.email ?? nextEmail;
      setEmail(currentEmail);
      setNewEmail(currentEmail);
      showMoment(
        "email_saved",
        "settings-email",
        "mail",
        currentEmail === nextEmail
          ? undefined
          : t("settings.emailConfirm"),
      );
    } catch (updateError: unknown) {
      setError(
        getErrorMessage(updateError, t("settings.emailError")),
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    if (busyAction) return;

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(
        t("settings.passwordTooShort", { count: MIN_PASSWORD_LENGTH }),
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("settings.passwordMismatch"));
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
      showMoment("password_saved", "settings-password", "check");
    } catch (updateError: unknown) {
      setError(
        getErrorMessage(updateError, t("settings.passwordError")),
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
      setError(getErrorMessage(logoutError, t("settings.logoutError")));
      setBusyAction(null);
    }
  }

  async function exportAccountData() {
    if (busyAction) return;

    beginAction("export");
    try {
      const supabase = supabaseBrowser();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) {
        throw new Error(t("settings.sessionExpired"));
      }

      const response = await fetch("/api/account/export", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const message =
          response.status === 401
            ? t("settings.sessionExpired")
            : response.status === 429
              ? t("settings.exportRateLimited")
              : t("settings.exportError");
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rootine-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError: unknown) {
      setError(getErrorMessage(exportError, t("settings.exportError")));
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteAccount() {
    if (deleteConfirmation !== "DELETE" || !deletePassword || busyAction) return;

    beginAction("delete");
    try {
      const supabase = supabaseBrowser();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) {
        throw new Error(t("settings.sessionExpired"));
      }

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: deletePassword }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? t("settings.deleteError"));
      }

      await supabase.auth.signOut({ scope: "local" });
      router.replace("/login");
    } catch (deleteError: unknown) {
      setError(
        getErrorMessage(deleteError, t("settings.deleteError")),
      );
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <LoadingState label={t("settings.loading")} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={t("settings.space")}
        title={t("settings.title")}
        description={t("settings.description")}
      />

      {error && (
        <div className="mb-6">
          <ErrorNotice>{error}</ErrorNotice>
        </div>
      )}

      <Card tone="soft" className="mb-6">
        <SectionHeading
          title={t("settings.guide")}
          description={t("settings.guideBody")}
          action={
            <Link href="/guide" className="btn btn-secondary">
              {t("settings.openGuide")}
              <Icon name="chevron" size={16} />
            </Link>
          }
        />
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <SectionHeading
              title={t("settings.profile")}
              description={t("settings.profileBody")}
            />
            <form className="mt-6 space-y-5" onSubmit={saveProfile}>
              <label className="grid gap-2 text-sm font-medium">
                {t("settings.displayName")}
                <Input
                  value={displayName}
                  maxLength={80}
                  autoComplete="name"
                  disabled={Boolean(busyAction)}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
              <MomentSource id="settings-profile">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={Boolean(busyAction) || !displayName.trim()}
                  busy={busyAction === "profile"}
                >
                  {t("settings.saveProfile")}
                </Button>
              </MomentSource>
            </form>
          </Card>

          <Card>
            <SectionHeading
              title={t("login.email")}
              description={t("settings.emailBody")}
            />
            <form className="mt-6 space-y-5" onSubmit={updateEmail}>
              <label className="grid gap-2 text-sm font-medium">
                {t("settings.emailAddress")}
                <Input
                  type="email"
                  value={newEmail}
                  autoComplete="email"
                  disabled={Boolean(busyAction)}
                  onChange={(event) => setNewEmail(event.target.value)}
                />
              </label>
              <MomentSource id="settings-email">
                <Button
                  type="submit"
                  disabled={
                    Boolean(busyAction) ||
                    !newEmail.trim() ||
                    newEmail.trim() === email
                  }
                  busy={busyAction === "email"}
                >
                  {t("settings.updateEmail")}
                </Button>
              </MomentSource>
            </form>
          </Card>

          <Card>
            <SectionHeading
              title={t("login.password")}
              description={t("settings.passwordBody", {
                count: MIN_PASSWORD_LENGTH,
              })}
            />
            <form className="mt-6 space-y-5" onSubmit={updatePassword}>
              <label className="grid gap-2 text-sm font-medium">
                {t("settings.newPassword")}
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
                {t("settings.confirmPassword")}
                <Input
                  type="password"
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirmPassword}
                  autoComplete="new-password"
                  disabled={Boolean(busyAction)}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <MomentSource id="settings-password">
                <Button
                  type="submit"
                  disabled={
                    Boolean(busyAction) || !newPassword || !confirmPassword
                  }
                  busy={busyAction === "password"}
                >
                  {t("settings.changePassword")}
                </Button>
              </MomentSource>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionHeading
              title={t("theme.title")}
              description={t("theme.description")}
            />
            <div className="mt-6 max-w-sm">
              <ThemePicker />
              <div className="mt-6">
                <LanguagePicker />
              </div>
            </div>
          </Card>

          <InstallAppCard />

          {userId && <ReminderSettings userId={userId} />}

          <Card>
            <SectionHeading
              title={t("settings.session")}
              description={t("settings.sessionBody")}
            />
            <Button
              className="mt-6"
              onClick={logout}
              disabled={Boolean(busyAction)}
              busy={busyAction === "logout"}
            >
              <Icon name="logout" size={17} />
              {t("settings.logout")}
            </Button>
          </Card>

          <Card>
            <SectionHeading
              title={t("settings.export")}
              description={t("settings.exportBody")}
            />
            <Button
              className="mt-6"
              onClick={exportAccountData}
              disabled={Boolean(busyAction)}
              busy={busyAction === "export"}
            >
              {t("settings.exportMine")}
            </Button>
          </Card>

          <Card className="border-danger-border">
            <SectionHeading
              title={t("settings.delete")}
              description={t("settings.deleteBody")}
            />
            <div className="mt-6 space-y-4">
              <p className="text-sm leading-6 text-muted">
                {t("settings.typeDelete")}
              </p>
              <Input
                value={deleteConfirmation}
                placeholder="DELETE"
                autoComplete="off"
                disabled={Boolean(busyAction)}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
              <label className="grid gap-2 text-sm font-medium">
                {t("settings.currentPassword")}
                <Input
                  type="password"
                  value={deletePassword}
                  autoComplete="current-password"
                  disabled={Boolean(busyAction)}
                  onChange={(event) => setDeletePassword(event.target.value)}
                />
              </label>
              <Button
                variant="danger"
                onClick={deleteAccount}
                disabled={
                  Boolean(busyAction) ||
                  deleteConfirmation !== "DELETE" ||
                  !deletePassword
                }
                busy={busyAction === "delete"}
              >
                <Icon name="trash" size={17} />
                {t("settings.deleteMine")}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <MomentPopup notice={moment} onDismiss={() => setMoment(null)} />
    </PageShell>
  );
}
