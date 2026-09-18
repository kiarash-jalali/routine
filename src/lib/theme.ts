export const themeStorageKey = "routine-theme";
export type ThemeMode = "auto" | "light" | "dark";
export type ThemePeriod = "morning" | "day" | "evening" | "night";
export function getThemePeriod(hour: number): ThemePeriod {
  return hour >= 5 && hour < 11
    ? "morning"
    : hour >= 11 && hour < 17
      ? "day"
      : hour >= 17 && hour < 21
        ? "evening"
        : "night";
}
export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "auto" || value === "light" || value === "dark";
}
export function applyTheme(mode: ThemeMode, now = new Date()) {
  const period = getThemePeriod(now.getHours());
  const theme =
    mode === "auto" ? (period === "night" ? "dark" : "light") : mode;
  const root = document.documentElement;
  root.dataset.themeMode = mode;
  root.dataset.theme = theme;
  root.dataset.period = period;
  const color =
    mode === "auto"
      ? {
          morning: "#f8f4e9",
          day: "#f5f5ee",
          evening: "#f5ede5",
          night: "#102825",
        }[period]
      : theme === "dark"
        ? "#102825"
        : "#f5f5ee";
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", color));
  window.dispatchEvent(new Event("routine-theme-change"));
}
export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(themeStorageKey, mode);
  } catch {
    /* Keep working for this visit. */
  }
  applyTheme(mode);
}
export function getSavedThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(themeStorageKey);
    if (isThemeMode(saved)) return saved;
  } catch {
    /* Use automatic. */
  }
  return "auto";
}
export function subscribeTheme(listener: () => void) {
  window.addEventListener("routine-theme-change", listener);
  return () => window.removeEventListener("routine-theme-change", listener);
}
export function themeSnapshot(): ThemeMode {
  const mode = document.documentElement.dataset.themeMode;
  return isThemeMode(mode) ? mode : "auto";
}
// Keep this first-paint calculation in sync with getThemePeriod; no media-query migration
// is needed because existing explicit light/dark preferences use the same storage key.
export const themeScript = `(()=>{let m;try{m=localStorage.getItem('${themeStorageKey}')}catch{}m=m==='light'||m==='dark'?m:'auto';const h=new Date().getHours(),p=h>=5&&h<11?'morning':h>=11&&h<17?'day':h>=17&&h<21?'evening':'night',r=document.documentElement;r.dataset.themeMode=m;r.dataset.period=p;r.dataset.theme=m==='auto'?(p==='night'?'dark':'light'):m})()`;
