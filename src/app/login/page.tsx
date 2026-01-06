"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    } catch (err: any) {
      setMsg(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Routine Helper</h1>
        <p className="text-sm text-gray-600 mt-1">
          {mode === "login" ? "Log in to your dashboard" : "Create your account"}
        </p>

        <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Password (min 6 chars)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          <button
            className="w-full rounded-xl bg-black text-white py-2 disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>

        {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}

        <button
          className="mt-4 text-sm underline"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          type="button"
        >
          {mode === "login" ? "No account? Sign up" : "Have an account? Log in"}
        </button>
      </div>
    </main>
  );
}
