"use client";

import { useEffect } from "react";
import {
  getNotificationPreference,
  syncNotificationPreferenceTimezone,
} from "@/lib/db/notifications";
import { reconcilePushNotifications } from "@/lib/notifications";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { ROOTINE_TIMEZONE_COOKIE } from "@/lib/timezone";

export function NotificationWorker() {
  useEffect(() => {
    const supabase = supabaseBrowser();
    let disposed = false;
    let lastTimezoneSyncKey: string | null = null;
    let lastPushSyncAt = 0;

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
      if (lastTimezoneSyncKey === syncKey) return;

      lastTimezoneSyncKey = syncKey;
      try {
        await syncNotificationPreferenceTimezone(userId, timezone);
      } catch {
        if (lastTimezoneSyncKey === syncKey) lastTimezoneSyncKey = null;
      }
    }

    async function reconcilePush(userId: string | null | undefined) {
      if (!userId || disposed) return;
      const now = Date.now();
      if (now - lastPushSyncAt < 60_000) return;
      lastPushSyncAt = now;

      try {
        const preference = await getNotificationPreference(userId);
        await reconcilePushNotifications(userId, Boolean(preference?.enabled));
      } catch {
        lastPushSyncAt = 0;
      }
    }

    async function syncFromSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user.id;
      await Promise.all([syncTimezone(userId), reconcilePush(userId)]);
    }

    void syncFromSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id;
      void syncTimezone(userId);
      void reconcilePush(userId);
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
