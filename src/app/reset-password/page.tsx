"use client";

import { useEffect, useState } from "react";
import { Link } from "next-view-transitions";
import { BrandMark } from "@/components/Icon";
import { LanguagePicker } from "@/components/preferences/LanguagePicker";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Button, ErrorNotice, Input } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkRecoverySession() {
      const supabase = supabaseBrowser();
      const { data, error } = await supabase.auth.getUser();

      if (cancelled) return;
      setValidSession(!error && !!data.user);
      setReady(true);
    }

    void checkRecoverySession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    setErrorMessage(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(
        t("passwordReset.tooShort", { count: MIN_PASSWORD_LENGTH }),
      );
      return;
    }

    if (password !== confirmation) {
      setErrorMessage(t("passwordReset.mismatch"));
      return;
    }

    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut();
      setComplete(true);
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(error, t("passwordReset.failedUpdate")),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="auth-page">
      <div className="auth-card">
        <div className="mb-6">
          <LanguagePicker />
        </div>
        <div className="mb-8 text-center">
          <BrandMark className="mb-6 h-14 w-14 rounded-[18px]" />
          <p className="mb-3 text-sm font-medium text-muted">rootine</p>
          <h1 className="display-title text-[40px] leading-tight">
            {complete
              ? t("passwordReset.successTitle")
              : t("passwordReset.newTitle")}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-6 text-muted">
            {complete
              ? t("passwordReset.successBody")
              : t("passwordReset.newBody", {
                  count: MIN_PASSWORD_LENGTH,
                })}
          </p>
        </div>

        <div className="card bg-surface p-7 sm:p-8">
          {!ready ? (
            <div className="space-y-3" role="status" aria-label={t("common.loading")}>
              <div className="skeleton h-12 w-full" />
              <div className="skeleton h-12 w-full" />
              <div className="skeleton h-12 w-full" />
            </div>
          ) : complete ? (
            <Link href="/login" className="btn btn-primary w-full">
              {t("passwordReset.back")}
            </Link>
          ) : !validSession ? (
            <div className="space-y-5">
              <ErrorNotice>{t("passwordReset.invalid")}</ErrorNotice>
              <Link href="/forgot-password" className="btn btn-primary w-full">
                {t("passwordReset.requestAgain")}
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm font-medium">
                {t("passwordReset.newPassword")}
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                {t("passwordReset.confirm")}
                <Input
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </label>

              {errorMessage && <ErrorNotice>{errorMessage}</ErrorNotice>}

              <Button
                variant="primary"
                className="w-full"
                disabled={loading}
                busy={loading}
                type="submit"
              >
                {loading
                  ? t("passwordReset.updating")
                  : t("passwordReset.update")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
