"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";

const noop = () => () => {};

export function PrintActions({ title, text }: { title: string; text: string }) {
  const { t } = useLanguage();
  // navigator.share exists only in the browser (and not everywhere).
  const canShare = useSyncExternalStore(
    noop,
    () => typeof navigator.share === "function",
    () => false,
  );
  return (
    <>
      <Button size="sm" onClick={() => window.print()}>
        {t("food.grocery.printNow")}
      </Button>
      {canShare && (
        <Button
          size="sm"
          onClick={() => void navigator.share({ title, text }).catch(() => undefined)}
        >
          {t("food.grocery.share")}
        </Button>
      )}
    </>
  );
}
