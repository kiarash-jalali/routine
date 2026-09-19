"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { SegmentedControl } from "@/components/ui";
import { useLanguage } from "./LanguageProvider";
import {
  setThemeMode,
  subscribeTheme,
  themeSnapshot,
  type ThemeMode,
} from "@/lib/theme";

export function ThemePicker() {
  const { t } = useLanguage();
  const mode = useSyncExternalStore(
    subscribeTheme,
    themeSnapshot,
    () => "auto" as const,
  );
  const icon = mode === "dark" ? "moon" : mode === "light" ? "sun" : "clock";

  return (
    <div className="grid gap-3 text-sm">
      <span className="flex items-center gap-2 font-medium">
        <Icon name={icon} size={18} />
        {t("theme.title")}
      </span>
      <SegmentedControl
        value={mode}
        onChange={(next: ThemeMode) => setThemeMode(next)}
        label={t("theme.title")}
        options={[
          { value: "auto", label: t("theme.auto") },
          { value: "light", label: t("theme.light") },
          { value: "dark", label: t("theme.dark") },
        ]}
      />
      <span className="text-muted">{t("theme.description")}</span>
    </div>
  );
}
