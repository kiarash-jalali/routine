"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { supabaseBrowser } from "@/lib/supabaseClient";

const FOCUS_REFRESH_MS = 5 * 60_000;

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
  const lastRefresh = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function loadOwner() {
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

        if (!cancelled) setUserId(user.id);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    void loadOwner();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const result = await load(userId, limit);
    setData(result);
    setNow(new Date());
    setError(false);
    lastRefresh.current = Date.now();
  }, [load, userId, limit]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function refreshSafely() {
      try {
        const result = await load(userId, limit);
        if (!cancelled) {
          setData(result);
          setNow(new Date());
          setError(false);
          lastRefresh.current = Date.now();
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    void refreshSafely();

    function onVisibilityChange() {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRefresh.current >= FOCUS_REFRESH_MS
      ) {
        void refreshSafely();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load, limit, userId]);

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
    more: () => setLimit((current) => current + 100),
  };
}
