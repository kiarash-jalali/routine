"use client";

import { useEffect, useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { ErrorNotice, PageShell } from "@/components/ui";
import { getSafeAuthCallbackPath } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useLanguage } from "@/components/preferences/LanguageProvider";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finishConfirmation() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const next = getSafeAuthCallbackPath(url.searchParams.get("next"));

        if (!code) {
          throw new Error(
            t("auth.missingCode"),
          );
        }

        const supabase = supabaseBrowser();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;

        if (!cancelled) router.replace(next);
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(
            getErrorMessage(
              error,
              t("auth.confirmError"),
            ),
          );
        }
      }
    }

    finishConfirmation();

    return () => {
      cancelled = true;
    };
  }, [router, t]);

  return (
    <PageShell className="max-w-xl">
      <div className="mt-16 rounded-3xl border border-border bg-surface p-6 text-center shadow-card sm:p-8">
        {errorMessage ? (
          <ErrorNotice>{errorMessage}</ErrorNotice>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              rootine
            </p>
            <h1 className="display-title mt-2 text-3xl text-foreground">
              {t("auth.confirming")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              {t("auth.confirmingBody")}
            </p>
          </>
        )}
      </div>
    </PageShell>
  );
}
