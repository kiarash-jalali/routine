"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";

const navItems = [
  { href: "/dashboard", label: "Today" },
  { href: "/checkin", label: "Check-in" },
  { href: "/routines", label: "Routines" },
] as const;

function linkClassName(active: boolean) {
  return [
    "rounded-lg px-3 py-2 text-sm font-medium transition",
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-ring",
    active
      ? "bg-primary-soft text-primary-strong"
      : "text-muted hover:bg-surface-soft hover:text-foreground",
  ].join(" ");
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav
      className="mb-8 flex flex-col gap-4 border-b border-border/80 pb-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Main navigation"
    >
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 self-start rounded-lg text-sm font-semibold tracking-[-0.01em] text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-ring"
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white shadow-button"
          aria-hidden="true"
        >
          R
        </span>
        <span>Routine Helper</span>
      </Link>

      <div className="flex flex-wrap items-center gap-1">
        {navItems.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={linkClassName(active)}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-ring"
          onClick={logout}
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
