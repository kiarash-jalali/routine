"use client";
import { useCallback, useEffect, useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { supabaseBrowser } from "@/lib/supabaseClient";
// Shared lifecycle only; each domain keeps its own data access and schema.
export function useOwnedData<T>(
  load: (userId: string, limit: number) => Promise<T>,
) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(100);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const {
          data: { user },
          error,
        } = await supabaseBrowser().auth.getUser();
        if (error) throw error;
        if (!user) {
          router.replace("/login");
          return;
        }
        const result = await load(user.id, limit);
        if (!cancelled) {
          setUserId(user.id);
          setData(result);
          setNow(new Date());
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    const focus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", focus);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [load, limit, router]);
  const refresh = useCallback(async () => {
    const result = await load(userId, limit);
    setData(result);
    setNow(new Date());
  }, [load, userId, limit]);
  async function act(action: () => Promise<void>) {
    if (busy || !userId) return false;
    setBusy(true);
    setError(false);
    try {
      await action();
      await refresh();
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return {
    userId,
    data,
    error,
    busy,
    now,
    act,
    limit,
    more: () => setLimit((n) => n + 100),
  };
}
