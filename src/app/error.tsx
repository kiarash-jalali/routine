"use client";

import { useEffect } from "react";
import { Link } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Button, Card, PageShell } from "@/components/ui";

async function fingerprint(value: string): Promise<string | undefined> {
  if (!value || !globalThis.crypto?.subtle) return undefined;
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function report() {
      const messageFingerprint = await fingerprint(error.message);
      if (cancelled) return;

      void fetch("/api/errors/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          digest: error.digest,
          fingerprint: messageFingerprint,
          name: error.name,
          pathname,
        }),
        keepalive: true,
      }).catch(() => undefined);
    }

    void report();
    return () => {
      cancelled = true;
    };
  }, [error, pathname]);

  return (
    <PageShell className="max-w-xl">
      <Card tone="soft" className="mt-12 text-center">
        <span className="icon-tile mx-auto mb-5 flex">
          <Icon name="spark" />
        </span>
        <h1 className="display-title text-3xl">{t("error.title")}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted">
          {t("error.body")}
        </p>
        {error.digest && (
          <p className="data-text mt-3 text-xs text-muted">
            {t("error.reference", { id: error.digest })}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="primary" onClick={reset}>
            {t("error.retry")}
          </Button>
          <Link href="/dashboard" className="btn btn-secondary">
            {t("error.today")}
          </Link>
        </div>
      </Card>
    </PageShell>
  );
}
