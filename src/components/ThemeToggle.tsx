"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/Icon";

import { themeStorageKey as storageKey } from "@/lib/theme";
type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  updateBrowserColor(theme);
  window.dispatchEvent(new Event("routine-theme-change"));
}

function updateBrowserColor(theme: Theme) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", theme === "dark" ? "#102825" : "#f5f5ee");
  });
}

function subscribe(onChange: () => void) {
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  function syncPreference() {
    let preference: string | null = null;
    try {
      preference = localStorage.getItem(storageKey);
    } catch {
      /* Use the system setting when storage is unavailable. */
    }
    applyTheme(
      preference === "light" || preference === "dark"
        ? preference
        : system.matches
          ? "dark"
          : "light",
    );
  }
  function onStorage(event: StorageEvent) {
    if (event.key === storageKey || event.key === null) syncPreference();
  }
  window.addEventListener("routine-theme-change", onChange);
  window.addEventListener("storage", onStorage);
  system.addEventListener("change", syncPreference);
  // Also catch a system or storage change between first paint and hydration.
  syncPreference();
  return () => {
    window.removeEventListener("routine-theme-change", onChange);
    window.removeEventListener("storage", onStorage);
    system.removeEventListener("change", syncPreference);
  };
}

function getTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light");
  const reduced = useReducedMotion();
  const dark = theme === "dark";
  function toggle() {
    const next = dark ? "light" : "dark";
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* The toggle still works for this visit. */
    }
    applyTheme(next);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label="Dark theme"
      aria-pressed={dark}
      title={`Switch to ${dark ? "light" : "dark"} theme`}
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
            <Icon name={dark ? "moon" : "sun"} size={19} />
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="theme-label">
        {dark ? "Evening palette" : "Daylight palette"}
      </span>
      <span className="theme-track" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}
