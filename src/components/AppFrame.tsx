"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";

const appPaths = ["/dashboard", "/routines", "/checkin", "/history"];
export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isApp = appPaths.includes(pathname);
  return (
    <div className={isApp ? "app-frame" : "auth-frame"}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {isApp && <AppNav />}
      <div className="route-view" key={pathname}>
        {children}
      </div>
    </div>
  );
}
