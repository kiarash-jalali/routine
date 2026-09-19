"use client";

import { useLanguage } from "@/components/preferences/LanguageProvider";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";

function passwordScore(password: string) {
  if (!password) return 0;
  let score = password.length >= MIN_PASSWORD_LENGTH ? 1 : 0;
  if (password.length >= 14) score += 1;
  if (/[a-z]/i.test(password) && /\d/.test(password)) score += 1;
  if (/[^a-z0-9]/i.test(password)) score += 1;
  return Math.min(score, 3);
}

export function PasswordGuidance({ password }: { password: string }) {
  const { t } = useLanguage();
  const score = passwordScore(password);
  const strength =
    score >= 3
      ? t("password.strong")
      : score >= 2
        ? t("password.fair")
        : t("password.weak");

  return (
    <div className="mt-2 space-y-2 text-xs leading-5 text-muted">
      <p>
        {t("password.requirement", { count: MIN_PASSWORD_LENGTH })}
      </p>
      {password && (
        <p role="status" aria-live="polite">
          {t("password.strength", { strength })}
        </p>
      )}
    </div>
  );
}
