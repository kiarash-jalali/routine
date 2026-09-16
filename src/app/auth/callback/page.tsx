"use client";

import { useEffect, useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { ErrorNotice, PageShell } from "@/components/ui";
import { getSafeAuthCallbackPath } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
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
            "This confirmation link is missing its sign-in code.",
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
              "Your email confirmation could not be completed.",
            ),
          );
        }
      }
    }

    finishConfirmation();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <PageShell className="max-w-xl">
      <div className="mt-16 rounded-3xl border border-border bg-surface p-6 text-center shadow-card sm:p-8">
        {errorMessage ? (
          <ErrorNotice>{errorMessage}</ErrorNotice>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Routine Helper
            </p>
            <h1 className="display-title mt-2 text-3xl text-foreground">
              Confirming your account…
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              This should only take a moment.
            </p>
          </>
        )}
      </div>
    </PageShell>
  );
}
