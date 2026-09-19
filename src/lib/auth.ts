import { translate, type Language } from "@/lib/i18n";

export const MIN_PASSWORD_LENGTH = 10;

const AUTH_CALLBACK_PATHS = new Set(["/onboarding", "/dashboard", "/reset-password"]);
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

type AuthErrorLike = {
  code?: unknown;
  message?: unknown;
};

export function getFriendlySignInError(
  error: unknown,
  language: Language = "en",
): string {
  const authError =
    typeof error === "object" && error !== null
      ? (error as AuthErrorLike)
      : null;
  const code = typeof authError?.code === "string" ? authError.code : "";
  const message =
    typeof authError?.message === "string" ? authError.message.toLowerCase() : "";

  // Supabase intentionally does not reveal whether an account exists for an
  // invalid email/password pair. Keep that protection while still giving a
  // short, useful message to the person signing in.
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return translate(language, "auth.invalidCredentials");
  }

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return translate(language, "auth.emailNotConfirmed");
  }

  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    message.includes("too many requests")
  ) {
    return translate(language, "auth.rateLimited");
  }

  if (code === "user_banned") {
    return translate(language, "auth.userBanned");
  }

  return translate(language, "auth.signInFailed");
}

export type PasswordStrength = "weak" | "fair" | "strong";

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return "weak";
  let score = password.length >= MIN_PASSWORD_LENGTH ? 1 : 0;
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 14) score += 1;
  return score >= 3 ? "strong" : score >= 2 ? "fair" : "weak";
}
