const FIRST_ROUTINE_SUCCESS_KEY = "rootine:first-routine-success";

export function rememberFirstRoutineSuccess(title: string) {
  if (typeof window === "undefined") return;

  const cleanTitle = title.trim();
  if (!cleanTitle) return;

  try {
    window.sessionStorage.setItem(FIRST_ROUTINE_SUCCESS_KEY, cleanTitle);
  } catch {
    // A blocked storage API should never prevent onboarding from completing.
  }
}

export function consumeFirstRoutineSuccess(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.sessionStorage.getItem(FIRST_ROUTINE_SUCCESS_KEY);
    if (value) window.sessionStorage.removeItem(FIRST_ROUTINE_SUCCESS_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}
