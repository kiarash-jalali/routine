"use client";

import { useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { AnimatedSwap, Collapse } from "@/components/Motion";
import { BrandMark, Icon } from "@/components/Icon";
import { Button, ErrorNotice, Input, SegmentedControl } from "@/components/ui";
import {
  getFriendlySignInError,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth";
import { getProfile } from "@/lib/db/profile";
import { getErrorMessage } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setErrorMessage(null);
    setLoading(true);

    try {
      const supabase = supabaseBrowser();

      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        const profile = await getProfile(data.user.id);
        router.push(
          profile?.onboarding_completed ? "/dashboard" : "/onboarding",
        );
        return;
      }

      const emailRedirectTo = `${window.location.origin}/auth/callback?next=/onboarding`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });

      if (error) throw error;

      if (data.session) {
        router.push("/onboarding");
      } else {
        setConfirmationSent(true);
      }
    } catch (error: unknown) {
      setErrorMessage(
        mode === "login"
          ? getFriendlySignInError(error)
          : getErrorMessage(error, "Couldn’t create your account. Try again."),
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setErrorMessage(null);
    setConfirmationSent(false);
  }

  return (
    <main id="main-content" className="auth-page">
      <div className="auth-card">
        <div className="mb-8 text-center">
          <BrandMark className="mb-6 h-14 w-14 rounded-[18px]" />
          <p className="mb-3 text-sm font-medium text-muted">Routine Helper</p>
          <AnimatedSwap value={confirmationSent ? "confirmation" : mode}>
            <h1 className="display-title text-[40px] leading-tight">
              {confirmationSent
                ? "Check your inbox."
                : mode === "login"
                  ? "Welcome back."
                  : "Start with something small."}
            </h1>
            <p className="mx-auto mt-3 max-w-xs text-[15px] leading-6 text-muted">
              {confirmationSent
                ? "One quick confirmation and you’re in."
                : mode === "login"
                  ? "Your space to find a little rhythm."
                  : "Make room for the routines that matter to you."}
            </p>
          </AnimatedSwap>
        </div>
        <div className="card bg-surface p-7 sm:p-8">
          <AnimatedSwap value={confirmationSent ? "confirmation" : "form"}>
            {confirmationSent ? (
              <div className="notice space-y-5" role="status">
                <span className="icon-tile mx-auto flex">
                  <Icon name="mail" />
                </span>
                <p className="text-center text-sm leading-6 text-muted">
                  We sent a confirmation link to{" "}
                  <strong className="text-foreground">{email}</strong>. Open it
                  to confirm your account and set up your space.
                </p>
                <p className="text-center text-sm leading-6 text-muted">
                  Can’t see it? Check your spam folder or wait a minute.
                </p>
                <Button
                  className="w-full"
                  onClick={() => setConfirmationSent(false)}
                >
                  Back to sign up
                </Button>
              </div>
            ) : (
              <>
                <SegmentedControl
                  value={mode}
                  label="Account access"
                  onChange={switchMode}
                  disabled={loading}
                  options={[
                    { value: "login", label: "Log in" },
                    { value: "signup", label: "Sign up" },
                  ]}
                />
                <AnimatedSwap value={mode}>
                  <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
                    <label className="grid gap-2 text-sm font-medium">
                      Email
                      <Input
                        placeholder="you@example.com"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        autoComplete="email"
                        disabled={loading}
                      />
                    </label>
                    <div>
                      <label
                        htmlFor="password"
                        className="mb-2 block text-sm font-medium"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <Input
                          id="password"
                          className="pr-14"
                          placeholder={
                            mode === "signup"
                              ? `At least ${MIN_PASSWORD_LENGTH} characters`
                              : "Your password"
                          }
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          required
                          minLength={
                            mode === "signup" ? MIN_PASSWORD_LENGTH : undefined
                          }
                          autoComplete={
                            mode === "login"
                              ? "current-password"
                              : "new-password"
                          }
                          disabled={loading}
                        />
                        <button
                          type="button"
                          className="icon-button absolute right-1 top-0.5"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          aria-pressed={showPassword}
                        >
                          <Icon name="eye" size={18} />
                        </button>
                      </div>
                    </div>
                    <Collapse show={!!errorMessage}>
                      <ErrorNotice>{errorMessage}</ErrorNotice>
                    </Collapse>
                    <Button
                      variant="primary"
                      className="w-full"
                      disabled={loading}
                      busy={loading}
                      type="submit"
                    >
                      {loading
                        ? "Please wait…"
                        : mode === "login"
                          ? "Log in"
                          : "Create account"}
                      {!loading && <Icon name="arrow" size={17} />}
                    </Button>
                  </form>
                </AnimatedSwap>
              </>
            )}
          </AnimatedSwap>
        </div>
        <p className="mt-7 text-center text-sm text-muted">
          A little, every day.
        </p>
      </div>
    </main>
  );
}
