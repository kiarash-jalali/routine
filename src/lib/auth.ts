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

export function getFriendlySignInError(error: unknown): string {
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
    return "Email or password doesn’t match. Check both and try again.";
  }

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Confirm your email first, then come back and sign in.";
  }

  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    message.includes("too many requests")
  ) {
    return "Too many tries for now. Give it a minute, then try again.";
  }

  if (code === "user_banned") {
    return "This account can’t sign in right now.";
  }

  return "Couldn’t sign you in right now. Try again in a moment.";
}
