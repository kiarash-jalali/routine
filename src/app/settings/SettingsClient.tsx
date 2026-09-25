"use client";

import { useState, type ReactNode } from "react";
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
  PageHeader,
  PageShell,
  SectionHeading,
} from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { PasswordGuidance } from "@/components/auth/PasswordGuidance";
import { ReminderSettings } from "@/components/notifications/ReminderSettings";
import { InstallAppCard } from "@/components/pwa/InstallAppCard";
import { saveDisplayName } from "@/lib/db/profile";
import { getErrorMessage } from "@/lib/errors";
import { getMomentCopy, type MomentCopyKey } from "@/lib/moments";
import { supabaseBrowser } from "@/lib/supabaseClient";

function SettingsDisclosure({
  title,
  description,
  children,
  danger = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <details
      className={`group overflow-hidden rounded-2xl border bg-background/30 ${
        danger ? "border-danger-border" : "border-border"
      }`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4">
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        </div>
        <Icon
          name="chevron"
          size={17}
          className="shrink-0 transition-transform group-open:rotate-90"
        />
      </summary>
      <div className="border-t border-border px-4 pb-5 pt-4">{children}</div>
    </details>
  );
}

export function SettingsClient({
  userId,
  initialDisplayName,
  initialEmail,
  initialLoadError,
}: {
  userId: string;
  initialDisplayName: string;
  initialEmail: string;
  initialLoadError: boolean;
}) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [email, setEmail] = useState(initialEmail);
  const [newEmail, setNewEmail] = useState(initialEmail);
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
  const [error, setError] = useState<string | null>(
    initialLoadError ? t("settings.loadError") : null,
  );
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

  const deleteWord = language === "fa" ? "حذف" : "DELETE";

  async function deleteAccount() {
    if (deleteConfirmation.trim() !== deleteWord || !deletePassword || busyAction) return;

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

      <div className="grid items-start gap-8 xl:grid-cols-2">
        <div className="space-y-8">
          <section className="space-y-3" aria-labelledby="settings-personal">
            <div className="px-1">
              <h2 id="settings-personal" className="display-title text-2xl">
                {t("settings.personal")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                {t("settings.personalBody")}
              </p>
            </div>
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

              <div className="my-6 border-t border-border" />
              <div className="grid gap-6">
                <ThemePicker />
                <div className="space-y-2">
                  <LanguagePicker />
                  <p className="text-sm leading-6 text-muted">
                    {t("language.description")}
                  </p>
                </div>
              </div>
            </Card>
          </section>
          <section className="space-y-3" aria-labelledby="settings-account">
            <div className="px-1">
              <h2 id="settings-account" className="display-title text-2xl">
                {t("settings.account")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                {t("settings.accountBody")}
              </p>
            </div>
            <Card>
              <div className="space-y-3">
                <SettingsDisclosure
                  title={t("login.email")}
                  description={t("settings.emailBody")}
                >
                  <form className="space-y-5" onSubmit={updateEmail}>
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
                </SettingsDisclosure>

                <SettingsDisclosure
                  title={t("login.password")}
                  description={t("settings.passwordBody", {
                    count: MIN_PASSWORD_LENGTH,
                  })}
                >
                  <form className="space-y-5" onSubmit={updatePassword}>
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
                    <PasswordGuidance password={newPassword} />
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
                </SettingsDisclosure>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                <div>
                  <h3 className="font-semibold">{t("settings.session")}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {t("settings.sessionBody")}
                  </p>
                </div>
                <Button
                  onClick={logout}
                  disabled={Boolean(busyAction)}
                  busy={busyAction === "logout"}
                >
                  <Icon name="logout" size={17} />
                  {t("settings.logout")}
                </Button>
              </div>
            </Card>
          </section>
        </div>

        <div className="space-y-8">
          <section className="space-y-3" aria-labelledby="settings-device">
            <div className="px-1">
              <h2 id="settings-device" className="display-title text-2xl">
                {t("settings.device")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                {t("settings.deviceBody")}
              </p>
            </div>
            <div className="space-y-6">
              <InstallAppCard />
              {userId && (
                <div id="reminders" className="scroll-mt-6">
                  <ReminderSettings userId={userId} />
                </div>
              )}
              <Card tone="soft">
                <SectionHeading title={t("settings.feedbackTitle")} description={t("settings.feedbackBody")} />
                <Link href="/feedback" className="btn btn-secondary mt-5 inline-flex">
                  <Icon name="mail" size={17} />
                  {t("settings.feedbackAction")}
                </Link>
              </Card>
            </div>
          </section>
          <section className="space-y-3" aria-labelledby="settings-data">
            <div className="px-1">
              <h2 id="settings-data" className="display-title text-2xl">
                {t("settings.data")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                {t("settings.dataBody")}
              </p>
            </div>
            <Card>
              <div className="space-y-3">
                <SettingsDisclosure
                  title={t("settings.export")}
                  description={t("settings.exportBody")}
                >
                  <Button
                    onClick={exportAccountData}
                    disabled={Boolean(busyAction)}
                    busy={busyAction === "export"}
                  >
                    {t("settings.exportMine")}
                  </Button>
                </SettingsDisclosure>

                <SettingsDisclosure
                  danger
                  title={t("settings.delete")}
                  description={t("settings.deleteBody")}
                >
                  <div className="space-y-4">
                    <p className="text-sm leading-6 text-muted">
                      {t("settings.typeDelete", { word: deleteWord })}
                    </p>
                    <Input
                      value={deleteConfirmation}
                      placeholder={deleteWord}
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
                        deleteConfirmation.trim() !== deleteWord ||
                        !deletePassword
                      }
                      busy={busyAction === "delete"}
                    >
                      <Icon name="trash" size={17} />
                      {t("settings.deleteMine")}
                    </Button>
                  </div>
                </SettingsDisclosure>
              </div>
            </Card>
          </section>
        </div>
      </div>
      <MomentPopup notice={moment} onDismiss={() => setMoment(null)} />
    </PageShell>
  );
}
