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

export type SignInErrorKey =
  | "login.errorInvalidCredentials"
  | "login.errorEmailNotConfirmed"
  | "login.errorRateLimited"
  | "login.errorBanned"
  | "login.errorGeneric";

export function getFriendlySignInErrorKey(error: unknown): SignInErrorKey {
  const authError =
    typeof error === "object" && error !== null
      ? (error as AuthErrorLike)
      : null;
  const code = typeof authError?.code === "string" ? authError.code : "";
  const message =
    typeof authError?.message === "string" ? authError.message.toLowerCase() : "";

  if (
    code === "invalid_credentials" ||
    message.includes("invalid login credentials")
  ) {
    return "login.errorInvalidCredentials";
  }
  if (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed")
  ) {
    return "login.errorEmailNotConfirmed";
  }
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    message.includes("too many requests")
  ) {
    return "login.errorRateLimited";
  }
  if (code === "user_banned") return "login.errorBanned";
  return "login.errorGeneric";
}
