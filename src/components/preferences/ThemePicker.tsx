"use client";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { useLanguage } from "./LanguageProvider";
import {
  setThemeMode,
  subscribeTheme,
  themeSnapshot,
  type ThemeMode,
} from "@/lib/theme";

const order: ThemeMode[] = ["auto", "light", "dark"];

export function ThemePicker() {
  const { t } = useLanguage();
  const mode = useSyncExternalStore(
    subscribeTheme,
    themeSnapshot,
    () => "auto" as const,
  );

  function cycle() {
    const index = order.indexOf(mode);
    setThemeMode(order[(index + 1) % order.length]);
  }

  const icon = mode === "dark" ? "moon" : mode === "light" ? "sun" : "clock";

  return (
    <div className="grid gap-2 text-sm">
      <span>{t("theme.title")}</span>
      <button
        type="button"
        className="btn justify-start"
        aria-label={t("theme.title")}
        onClick={cycle}
      >
        <Icon name={icon} size={18} />
        {t(`theme.${mode}`)}
      </button>
      <span className="text-muted">{t("theme.description")}</span>
    </div>
  );
}
