"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { replayOfflineMutation } from "@/lib/db/checkins";
import {
  clearOfflineData,
  getPendingOfflineMutationCount,
  listOfflineMutations,
  OFFLINE_QUEUE_EVENT,
  removeOfflineMutation,
} from "@/lib/offlineStore";
import { supabaseBrowser } from "@/lib/supabaseClient";

export function PwaStatus() {
  const { t, number } = useLanguage();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  const reloadForUpdateRef = useRef(false);

  const refreshPending = useCallback(async (userId?: string | null) => {
    const activeUserId = userId ?? userIdRef.current;
    if (!activeUserId) {
      setPending(0);
      return;
    }

    try {
      setPending(await getPendingOfflineMutationCount(activeUserId));
    } catch {
      // IndexedDB can be unavailable in restricted browser modes.
    }
  }, []);

  const flushQueue = useCallback(
    async (userId?: string | null) => {
      const activeUserId = userId ?? userIdRef.current;
      if (
        !activeUserId ||
        typeof navigator === "undefined" ||
        !navigator.onLine ||
        syncingRef.current
      ) {
        return;
      }

      syncingRef.current = true;
      setSyncing(true);
      setSyncError(false);
      try {
        const mutations = await listOfflineMutations(activeUserId);
        for (const mutation of mutations) {
          await replayOfflineMutation(mutation);
          await removeOfflineMutation(mutation.id);
        }
      } catch {
        setSyncError(true);
      } finally {
        syncingRef.current = false;
        setSyncing(false);
        await refreshPending(activeUserId);
      }
    },
    [refreshPending],
  );

  useEffect(() => {
    const supabase = supabaseBrowser();
    setOnline(navigator.onLine);

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      userIdRef.current = session?.user.id ?? null;
      if (!userIdRef.current) {
        await clearOfflineData().catch(() => undefined);
        setPending(0);
        return;
      }
      await refreshPending(userIdRef.current);
      if (navigator.onLine) await flushQueue(userIdRef.current);
    }

    function onOnline() {
      setOnline(true);
      void flushQueue();
    }

    function onOffline() {
      setOnline(false);
    }

    function onQueueChanged() {
      void refreshPending();
      if (navigator.onLine) void flushQueue();
    }

    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      setOnline(navigator.onLine);
      if (navigator.onLine) void flushQueue();
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      userIdRef.current = session?.user.id ?? null;
      if (event === "SIGNED_OUT") {
        void clearOfflineData().then(() => setPending(0));
        return;
      }
      void refreshPending(userIdRef.current);
      if (navigator.onLine) void flushQueue(userIdRef.current);
    });

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, onQueueChanged);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, onQueueChanged);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [flushQueue, refreshPending]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;

    function inspectWaiting() {
      if (!disposed) setUpdateAvailable(Boolean(registration?.waiting));
    }

    function onUpdateFound() {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (
          installing.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          inspectWaiting();
        }
      });
    }

    function onControllerChange() {
      if (reloadForUpdateRef.current) window.location.reload();
    }

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((value) => {
        if (disposed) return;
        registration = value;
        inspectWaiting();
        registration.addEventListener("updatefound", onUpdateFound);
        void registration.update().catch(() => undefined);
      })
      .catch(() => undefined);

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    return () => {
      disposed = true;
      registration?.removeEventListener("updatefound", onUpdateFound);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  function activateUpdate() {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.getRegistration("/").then((registration) => {
      if (!registration?.waiting) return;
      reloadForUpdateRef.current = true;
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    });
  }

  const showConnectivity = !online || pending > 0 || syncError;
  if (!showConnectivity && !updateAvailable) return null;

  return (
    <div
      className="fixed bottom-24 start-4 end-4 z-50 mx-auto max-w-xl space-y-3"
      aria-live="polite"
    >
      {showConnectivity && (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-lg">
          <p className="font-semibold">
            {!online ? t("pwa.offlineTitle") : t("pwa.pendingTitle")}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted">
            {!online
              ? t("pwa.offlineBody")
              : syncing
                ? t("pwa.syncing")
                : syncError
                  ? t("pwa.syncError")
                  : t("pwa.pending", { count: number(pending) })}
          </p>
          {syncError && online && (
            <Button className="mt-3" onClick={() => void flushQueue()}>
              {t("pwa.retrySync")}
            </Button>
          )}
        </div>
      )}
      {updateAvailable && (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-lg">
          <p className="font-semibold">{t("pwa.updateTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            {t("pwa.updateBody")}
          </p>
          <Button className="mt-3" variant="primary" onClick={activateUpdate}>
            {t("pwa.updateAction")}
          </Button>
        </div>
      )}
    </div>
  );
}
