"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorNotice, Input } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const supabase = supabaseBrowser();
      const { error } =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });

      if (error) throw error;
      router.push("/dashboard");
    } catch (error: unknown) {
      setMsg(getErrorMessage(error, "Something went wrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-white shadow-card">
            R
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Routine Helper
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {mode === "login" ? "Welcome back." : "Start gently."}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            A calm place for routines, tasks, and the small ritual of checking
            in with your day.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-foreground">Email</span>
              <Input
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-foreground">Password</span>
              <Input
                placeholder="At least 6 characters"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>

            <Button variant="primary" className="w-full" disabled={loading} type="submit">
              {loading
                ? "Please wait…"
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            </Button>
          </form>

          {msg && (
            <div className="mt-4">
              <ErrorNotice>{msg}</ErrorNotice>
            </div>
          )}

          <div className="mt-6 border-t border-border pt-5 text-center">
            <button
              className="text-sm font-medium text-primary transition hover:text-primary-strong"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              type="button"
            >
              {mode === "login"
                ? "New here? Create an account"
                : "Already have an account? Log in"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
