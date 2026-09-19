"use client";

import { useLinkStatus } from "next/link";
import { Link } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { type CSSProperties } from "react";
import { BrandMark, Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLanguage } from "@/components/preferences/LanguageProvider";

const navItems = [
  { href: "/dashboard", label: "nav.today", icon: "today" },
  { href: "/routines", label: "nav.routines", icon: "routines" },
  { href: "/checkin", label: "nav.checkin", icon: "checkin" },
  { href: "/history", label: "nav.history", icon: "history" },
] as const;

function NavPending() {
  const { t } = useLanguage();
  const { pending } = useLinkStatus();
  return pending ? <span className="nav-pending" aria-label={t("common.loading")} /> : null;
}

export function AppNav() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const activeIndex = navItems.findIndex((item) => pathname === item.href);

  return (
    <aside className="app-navigation">
      <Link href="/dashboard" className="brand-link" aria-label={t("nav.home")}>
        <BrandMark />
        <span>rootine<span className="brand-caption">{t("nav.tagline")}</span></span>
      </Link>
      <nav aria-label={t("nav.main")} className="nav-tabs" style={activeIndex >= 0 ? ({ "--active-tab": activeIndex } as CSSProperties) : undefined}>
        {activeIndex >= 0 && <span className="nav-indicator" aria-hidden="true" />}
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="nav-tab" aria-current={pathname === item.href ? "page" : undefined}>
            <Icon name={item.icon} size={21} />
            <span>{t(item.label)}</span>
            <NavPending />
          </Link>
        ))}
      </nav>
      <div className="nav-footer">
        <Link href="/settings" className="logout-button" aria-current={pathname === "/settings" ? "page" : undefined} aria-label={t("nav.settings")}>
          <Icon name="settings" size={19} />
          <span>{t("nav.settings")}</span>
        </Link>
        <Link href="/guide" className="logout-button" aria-current={pathname === "/guide" ? "page" : undefined} aria-label={t("nav.guide")}>
          <Icon name="rootine" size={19} />
          <span>{t("nav.guide")}</span>
        </Link>
        <Link href="/feedback" className="logout-button" aria-current={pathname === "/feedback" ? "page" : undefined} aria-label={t("nav.feedback")}>
          <Icon name="mail" size={19} />
          <span>{t("nav.feedback")}</span>
        </Link>
        <div className="hidden lg:block">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
