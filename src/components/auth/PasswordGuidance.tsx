"use client";

import { getPasswordStrength, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { useLanguage } from "@/components/preferences/LanguageProvider";

export function PasswordGuidance({
  password,
  id,
}: {
  password: string;
  id?: string | undefined;
}) {
  const { t } = useLanguage();
  const strength = getPasswordStrength(password);
  const width = strength === "strong" ? "100%" : strength === "fair" ? "66%" : "33%";

  return (
    <div className="mt-2" aria-live="polite">
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-soft" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width }} />
      </div>
      <p id={id} className="mt-2 text-xs leading-5 text-muted">
        {t(`password.strength.${strength}`)} ·{" "}
        {t("password.guidance", { count: MIN_PASSWORD_LENGTH })}
      </p>
    </div>
  );
}
