"use client";
import { Link } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/preferences/LanguageProvider";
export function LifeLinks() {
  const { t } = useLanguage();
  const path = usePathname();
  return (
    <nav aria-label={t("nav.life")} className="life-links">
      <Link
        href="/health"
        aria-current={path === "/health" ? "page" : undefined}
      >
        {t("nav.health")}
      </Link>
      <Link
        href="/workouts"
        aria-current={path === "/workouts" ? "page" : undefined}
      >
        {t("nav.workouts")}
      </Link>
    </nav>
  );
}
