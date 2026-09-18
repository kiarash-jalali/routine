"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/Icon";

import { setThemeMode, subscribeTheme, themeSnapshot } from "@/lib/theme";
import { useLanguage } from "@/components/preferences/LanguageProvider";

export function ThemeToggle() {
  const { t } = useLanguage();
  const mode = useSyncExternalStore(
    subscribeTheme,
    themeSnapshot,
    () => "auto" as const,
  );
  const reduced = useReducedMotion();
  const theme = mode;
  function toggle() {
    setThemeMode(
      mode === "auto" ? "light" : mode === "light" ? "dark" : "auto",
    );
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={t("theme.toggle")}

      title={t(`theme.${mode}`)}
    >
      <span className="theme-icon" aria-hidden="true">
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={theme}
            initial={{
              opacity: 0,
              rotate: reduced ? 0 : -70,
              scale: reduced ? 1 : 0.6,
            }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{
              opacity: 0,
              rotate: reduced ? 0 : 70,
              scale: reduced ? 1 : 0.6,
            }}
            transition={{ duration: reduced ? 0 : 0.18 }}
          >
            <Icon
              name={mode === "auto" ? "clock" : mode === "dark" ? "moon" : "sun"}
              size={19}
            />
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="theme-label">{t(`theme.${mode}`)}</span>
      <span className="theme-track" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}
