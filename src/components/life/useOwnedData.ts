"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FOCUS_REFRESH_MS = 5 * 60_000;

export function useOwnedData<T>(
  load: (userId: string, limit: number) => Promise<T>,
  userId: string,
  initialData: T,
  initialLoadError = false,
) {
  const [data, setData] = useState<T>(initialData);
  const [error, setError] = useState(initialLoadError);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(100);
  const [now, setNow] = useState(() => new Date());
  const lastRefresh = useRef(Date.now());

  const refresh = useCallback(async () => {
    const result = await load(userId, limit);
    setData(result);
    setNow(new Date());
    setError(false);
    lastRefresh.current = Date.now();
  }, [load, userId, limit]);

  useEffect(() => {
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

    if (limit > 100) void refreshSafely();

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
    if (busy) return false;
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
