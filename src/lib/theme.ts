export const themeStorageKey = "routine-theme";

export type ThemeMode = "auto" | "system" | "light" | "dark";
export type ThemePeriod = "morning" | "day" | "evening" | "night";
export type ResolvedTheme = "light" | "dark";

export const themePeriodRanges = [
  { period: "morning", start: 5, end: 11 },
  { period: "day", start: 11, end: 17 },
  { period: "evening", start: 17, end: 21 },
] as const satisfies ReadonlyArray<{
  period: Exclude<ThemePeriod, "night">;
  start: number;
  end: number;
}>;

export const themePeriodExpression =
  themePeriodRanges
    .map(({ period, start, end }) => `h>=${start}&&h<${end}?'${period}':`)
    .join("") + "'night'";

export function getThemePeriod(hour: number): ThemePeriod {
  return (
    themePeriodRanges.find(({ start, end }) => hour >= start && hour < end)
      ?.period ?? "night"
  );
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return (
    value === "auto" ||
    value === "system" ||
    value === "light" ||
    value === "dark"
  );
}

export function resolveTheme(
  mode: ThemeMode,
  period: ThemePeriod,
  systemPrefersDark = false,
): ResolvedTheme {
  if (mode === "system") return systemPrefersDark ? "dark" : "light";
  if (mode === "auto") return period === "night" ? "dark" : "light";
  return mode;
}

function prefersDarkTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function themeColor(
  mode: ThemeMode,
  period: ThemePeriod,
  resolved: ResolvedTheme,
) {
  if (mode === "auto") {
    return {
      morning: "#f8f4e9",
      day: "#f5f5ee",
      evening: "#f5ede5",
      night: "#102825",
    }[period];
  }

  return resolved === "dark" ? "#102825" : "#f5f5ee";
}

export function applyTheme(mode: ThemeMode, now = new Date()) {
  const period = getThemePeriod(now.getHours());
  const resolved = resolveTheme(mode, period, prefersDarkTheme());
  const root = document.documentElement;

  root.dataset.themeMode = mode;
  root.dataset.theme = resolved;
  root.dataset.period = period;

  const color = themeColor(mode, period, resolved);
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

export const themeScript = `(()=>{let m;try{m=localStorage.getItem('${themeStorageKey}')}catch{}m=m==='auto'||m==='system'||m==='light'||m==='dark'?m:'auto';const h=new Date().getHours(),p=${themePeriodExpression},s=window.matchMedia('(prefers-color-scheme: dark)').matches,t=m==='system'?(s?'dark':'light'):m==='auto'?(p==='night'?'dark':'light'):m,r=document.documentElement;r.dataset.themeMode=m;r.dataset.period=p;r.dataset.theme=t;const c=m==='auto'?({morning:'#f8f4e9',day:'#f5f5ee',evening:'#f5ede5',night:'#102825'})[p]:t==='dark'?'#102825':'#f5f5ee';document.querySelectorAll('meta[name="theme-color"]').forEach(e=>e.setAttribute('content',c))})()`;
