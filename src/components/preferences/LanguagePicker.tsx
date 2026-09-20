"use client";
import { useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { isLanguage } from "@/lib/i18n";
export function LanguagePicker() {
  const { language, setLanguage, t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div>
      <label className="grid gap-2 text-sm font-medium">
        {t("language.title")}
        <select
          aria-label={t("language.title")}
          className="field"
          value={language}
          disabled={busy}
          onChange={async (event) => {
            const next = event.target.value;
            if (!isLanguage(next)) return;
            setBusy(true);
            setFailed(false);
            try {
              await setLanguage(next);
            } catch {
              setFailed(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <option value="en" lang="en">
            {t("language.english")}
          </option>
          <option value="fa" lang="fa">
            {t("language.persian")}
          </option>
        </select>
      </label>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {t("language.error")}
        </p>
      )}
    </div>
  );
}
