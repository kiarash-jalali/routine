"use client";
import { useSyncExternalStore } from "react";
import { useLanguage } from "./LanguageProvider";
import {
  isThemeMode,
  setThemeMode,
  subscribeTheme,
  themeSnapshot,
} from "@/lib/theme";
export function ThemePicker() {
  const { t } = useLanguage();
  const mode = useSyncExternalStore(
    subscribeTheme,
    themeSnapshot,
    () => "auto" as const,
  );
  return (
    <label className="grid gap-2 text-sm">
      <span>{t("theme.title")}</span>
      <select
        className="field"
        value={mode}
        onChange={(e) => {
          if (isThemeMode(e.target.value)) setThemeMode(e.target.value);
        }}
      >
        {(["auto", "light", "dark"] as const).map((value) => (
          <option key={value} value={value}>
            {t(`theme.${value}`)}
          </option>
        ))}
      </select>
      <span className="text-muted">{t("theme.description")}</span>
    </label>
  );
}
