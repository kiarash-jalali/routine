"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";
import { useLanguage } from "@/components/preferences/LanguageProvider";

const appPaths = [
  "/dashboard",
  "/routines",
  "/checkin",
  "/history",
  "/settings",
  "/feedback",
  "/health",
  "/workouts",
  "/guide",
  "/design-lab",
];

export function AppFrame({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const isApp = appPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  return (
    <div className={isApp ? "app-frame" : "auth-frame"}>
      <a href="#main-content" className="skip-link">
        {t("common.skipContent")}
      </a>
      {isApp && <AppNav />}
      <div className="route-view" key={pathname}>
        {children}
      </div>
    </div>
  );
}
