"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import {
  setThemeMode,
  subscribeTheme,
  themeSnapshot,
  type ThemeMode,
} from "@/lib/theme";
import { useLanguage } from "@/components/preferences/LanguageProvider";

const cycleModes = ["auto", "light", "dark"] as const satisfies readonly ThemeMode[];

export function ThemeToggle() {
  const { t } = useLanguage();
  const mode = useSyncExternalStore(
    subscribeTheme,
    themeSnapshot,
    () => "auto" as const,
  );
  const visibleMode = cycleModes.includes(mode as (typeof cycleModes)[number])
    ? mode
    : "auto";
  const nextIndex =
    (cycleModes.indexOf(visibleMode as (typeof cycleModes)[number]) + 1) %
    cycleModes.length;
  const nextMode = cycleModes[nextIndex] ?? "auto";
  const modeLabel =
    visibleMode === "auto"
      ? t("theme.autoShort")
      : t(`theme.${visibleMode}`);

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={t("theme.currentMode", { mode: modeLabel })}
      title={t("theme.toggle")}
      onClick={() => setThemeMode(nextMode)}
    >
      <span className="theme-icon" aria-hidden="true">
        <Icon
          name={
            visibleMode === "auto"
              ? "clock"
              : visibleMode === "dark"
                ? "moon"
                : "sun"
          }
          size={18}
        />
      </span>
      <span className="theme-label">{t("theme.title")}</span>
      <span className="theme-mode">{modeLabel}</span>
    </button>
  );
}
