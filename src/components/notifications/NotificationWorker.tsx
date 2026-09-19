"use client";

import { useEffect } from "react";
import { syncNotificationPreferenceTimezone } from "@/lib/db/notifications";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { ROOTINE_TIMEZONE_COOKIE } from "@/lib/timezone";

export function NotificationWorker() {
  useEffect(() => {
    const supabase = supabaseBrowser();
    let disposed = false;
    let lastSyncKey: string | null = null;

    async function syncTimezone(userId: string | null | undefined) {
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie =
        ROOTINE_TIMEZONE_COOKIE +
        "=" +
        encodeURIComponent(timezone) +
        "; Path=/; Max-Age=31536000; SameSite=Lax" +
        secure;

      if (!userId || disposed) return;
      const syncKey = `${userId}:${timezone}`;
      if (lastSyncKey === syncKey) return;

      lastSyncKey = syncKey;
      try {
        await syncNotificationPreferenceTimezone(userId, timezone);
      } catch {
        if (lastSyncKey === syncKey) lastSyncKey = null;
      }
    }

    async function syncFromSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await syncTimezone(session?.user.id);
    }

    // Updating the worker does not request permission or subscribe the device.
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => undefined);
    }

    void syncFromSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncTimezone(session?.user.id);
    });

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void syncFromSession();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
