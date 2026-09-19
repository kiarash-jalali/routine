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

const modes: ThemeMode[] = ["auto", "light", "dark"];

export function ThemeToggle() {
  const { t } = useLanguage();
  const mode = useSyncExternalStore(
    subscribeTheme,
    themeSnapshot,
    () => "auto" as const,
  );

  return (
    <label className="theme-toggle">
      <span className="theme-icon" aria-hidden="true">
        <Icon
          name={mode === "auto" ? "clock" : mode === "dark" ? "moon" : "sun"}
          size={19}
        />
      </span>
      <span className="theme-label">{t("theme.title")}</span>
      <select
        className="theme-select"
        value={mode}
        aria-label={t("theme.title")}
        onChange={(event) => setThemeMode(event.target.value as ThemeMode)}
      >
        {modes.map((value) => (
          <option value={value} key={value}>
            {t(`theme.${value}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
