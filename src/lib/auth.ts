export const MIN_PASSWORD_LENGTH = 10;

const AUTH_CALLBACK_PATHS = new Set(["/onboarding", "/dashboard"]);
const AUTH_CALLBACK_ORIGIN = "https://routine.invalid";

export function getSafeAuthCallbackPath(value: string | null): string {
  if (!value) return "/onboarding";

  try {
    const parsed = new URL(value, AUTH_CALLBACK_ORIGIN);
    if (
      parsed.origin !== AUTH_CALLBACK_ORIGIN ||
      !AUTH_CALLBACK_PATHS.has(parsed.pathname)
    ) {
      return "/onboarding";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/onboarding";
  }
}
