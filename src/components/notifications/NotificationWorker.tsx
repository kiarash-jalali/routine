"use client";
import { useEffect } from "react";
export function NotificationWorker() {
  useEffect(() => {
    // Updating the worker does not request permission or subscribe the device.
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => undefined);
  }, []);
  return null;
}
