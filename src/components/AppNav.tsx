"use client";

import { useLinkStatus } from "next/link";
import { Link, useTransitionRouter as useRouter } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { BrandMark, Icon } from "@/components/Icon";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { ThemeToggle } from "@/components/ThemeToggle";

const navItems = [
  { href: "/dashboard", label: "Today", icon: "today" },
  { href: "/routines", label: "Routines", icon: "routines" },
  { href: "/checkin", label: "Check-in", icon: "checkin" },
  { href: "/history", label: "History", icon: "history" },
] as const;

function NavPending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span className="nav-pending" aria-label="Loading page" />
  ) : null;
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState(false);
  const activeIndex = navItems.findIndex((item) => pathname === item.href);

  async function logout() {
    setLoggingOut(true);
    setError(false);
    try {
      const { error } = await supabaseBrowser().auth.signOut();
      if (error) throw error;
      router.replace("/login");
    } catch {
      setError(true);
      setLoggingOut(false);
    }
  }

  return (
    <aside className="app-navigation">
      <Link
        href="/dashboard"
        className="brand-link"
        aria-label="Routine Helper home"
      >
        <BrandMark />
        <span>
          routine<span className="brand-caption">A little, every day.</span>
        </span>
      </Link>
      <nav
        aria-label="Main navigation"
        className="nav-tabs"
        style={
          activeIndex >= 0
            ? ({ "--active-tab": activeIndex } as CSSProperties)
            : undefined
        }
      >
        {activeIndex >= 0 && (
          <span className="nav-indicator" aria-hidden="true" />
        )}
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-tab"
            aria-current={pathname === item.href ? "page" : undefined}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.label}</span>
            <NavPending />
          </Link>
        ))}
      </nav>
      <div className="nav-footer">
        <Link
          href="/settings"
          className="logout-button"
          aria-current={pathname === "/settings" ? "page" : undefined}
          aria-label="Settings"
        >
          <Icon name="settings" size={19} />
          <span>Settings</span>
        </Link>
        <Link
          href="/feedback"
          className="logout-button"
          aria-current={pathname === "/feedback" ? "page" : undefined}
          aria-label="Send feedback"
        >
          <Icon name="mail" size={19} />
          <span>Feedback</span>
        </Link>
        <ThemeToggle />
        {error && (
          <p role="alert" className="text-sm text-danger">
            Couldn’t log out. Try again.
          </p>
        )}
        <button
          type="button"
          className="logout-button"
          disabled={loggingOut}
          onClick={logout}
          aria-label={loggingOut ? "Logging out" : "Log out"}
        >
          <Icon name="logout" size={19} />
          <span>{loggingOut ? "Logging out…" : "Log out"}</span>
        </button>
      </div>
    </aside>
  );
}
