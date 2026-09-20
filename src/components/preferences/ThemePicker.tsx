"use client";

import { Icon } from "@/components/Icon";
import { SegmentedControl } from "@/components/ui";
import { useLanguage } from "./LanguageProvider";
import {
  setThemeMode,
  subscribeTheme,
  themeSnapshot,
  type ThemeMode,
} from "@/lib/theme";
import { useSyncExternalStore } from "react";

const options: ThemeMode[] = ["auto", "system", "light", "dark"];

export function ThemePicker() {
  const { t } = useLanguage();
  const mode = useSyncExternalStore(
    subscribeTheme,
    themeSnapshot,
    () => "auto" as const,
  );

  return (
    <div className="grid gap-3 text-sm">
      <div>
        <span className="font-medium">{t("theme.title")}</span>
        <p className="mt-1 text-sm leading-6 text-muted">{t("theme.description")}</p>
      </div>
      <SegmentedControl
        value={mode}
        onChange={setThemeMode}
        label={t("theme.title")}
        options={options.map((value) => ({
          value,
          label: t(`theme.${value}`),
        }))}
      />
      <p className="inline-flex items-center gap-2 text-sm text-muted" aria-live="polite">
        <Icon
          name={mode === "dark" ? "moon" : mode === "light" ? "sun" : "clock"}
          size={17}
        />
        {t("theme.currentMode", { mode: t(`theme.${mode}`) })}
      </p>
    </div>
  );
}
