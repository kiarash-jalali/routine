"use client";
import { useEffect } from "react";
import { applyTheme, getSavedThemeMode, themeSnapshot } from "@/lib/theme";
export function ThemeController() {
  useEffect(() => {
    applyTheme(getSavedThemeMode());
    const refresh = () => applyTheme(themeSnapshot());
    const storage = () => applyTheme(getSavedThemeMode());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return null;
}
