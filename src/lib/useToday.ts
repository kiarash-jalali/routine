"use client";

import { useEffect, useState } from "react";
import { getLocalDateKey } from "@/lib/today";

export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    let timer: number | undefined;

    function refreshDay() {
      const now = new Date();
      setToday((current) =>
        getLocalDateKey(current) === getLocalDateKey(now) ? current : now,
      );
    }

    function scheduleMidnight() {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 0, 50);
      timer = window.setTimeout(() => {
        refreshDay();
        scheduleMidnight();
      }, next.getTime() - now.getTime());
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") refreshDay();
    }

    scheduleMidnight();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return today;
}
