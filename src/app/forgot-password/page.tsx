"use client";

import { useState } from "react";
import { Link } from "next-view-transitions";
import { BrandMark, Icon } from "@/components/Icon";
import { LanguagePicker } from "@/components/preferences/LanguagePicker";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Button, ErrorNotice, Input } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    setErrorMessage(null);
    setLoading(true);

    try {
      const supabase = supabaseBrowser();
      const redirectTo =
        `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;
      setSent(true);
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(error, t("passwordReset.failedRequest")),
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
            {sent
              ? t("passwordReset.sentTitle")
              : t("passwordReset.requestTitle")}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-6 text-muted">
            {sent
              ? t("passwordReset.sentBody", { email })
              : t("passwordReset.requestBody")}
          </p>
        </div>

        <div className="card bg-surface p-7 sm:p-8">
          {sent ? (
            <div className="notice space-y-5" role="status">
              <span className="icon-tile mx-auto flex">
                <Icon name="mail" />
              </span>
              <Link href="/login" className="btn btn-primary w-full">
                {t("passwordReset.back")}
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm font-medium">
                {t("login.email")}
                <Input
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
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
                {loading ? t("login.wait") : t("passwordReset.send")}
                {!loading && <Icon name="arrow" size={17} />}
              </Button>

              <Link
                href="/login"
                className="block text-center text-sm font-medium text-primary hover:underline"
              >
                {t("passwordReset.back")}
              </Link>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
