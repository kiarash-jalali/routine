"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import {
  isLanguage,
  languageStorageKey,
  locales,
  translate,
  type Language,
  type TranslationKey,
} from "@/lib/i18n";
function applyLanguage(language: Language) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
  try {
    localStorage.setItem(languageStorageKey, language);
  } catch {
    /* In-memory preference still works. */
  }
  window.dispatchEvent(new Event("rootine-language"));
}
function subscribe(listener: () => void) {
  window.addEventListener("rootine-language", listener);
  function storage(event: StorageEvent) {
    if (event.key === languageStorageKey && isLanguage(event.newValue))
      applyLanguage(event.newValue);
  }
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener("rootine-language", listener);
    window.removeEventListener("storage", storage);
  };
}
function snapshot(): Language {
  return document.documentElement.lang === "fa" ? "fa" : "en";
}
async function setLanguage(language: Language) {
  const client = supabaseBrowser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user) {
    const { error } = await client
      .from("profiles")
      .update({ locale: language })
      .eq("user_id", user.id);
    if (error) throw error;
  }
  applyLanguage(language);
}
function makeValue(language: Language) {
  const locale = locales[language];
  return {
    language,
    locale,
    setLanguage,
    t: (key: TranslationKey, values?: Record<string, string | number>) =>
      translate(language, key, values),
    number: (value: number) => new Intl.NumberFormat(locale).format(value),
    date: (value: Date | string, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(
        locale,
        options ?? { dateStyle: "medium" },
      ).format(
        typeof value === "string"
          ? new Date(value.length === 10 ? `${value}T12:00:00` : value)
          : value,
      ),
    time: (value: string) =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(`2000-01-01T${value.slice(0, 5)}:00`)),
    weekday: (isoDay: number, format: "short" | "long" | "narrow" = "short") =>
      new Intl.DateTimeFormat(locale, { weekday: format }).format(
        new Date(2024, 0, isoDay),
      ),
  };
}
const LanguageContext = createContext(makeValue("en"));
export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "en" as const,
  );
  useEffect(() => {
    let cancelled = false;
    let requestedUser: string | undefined;
    const client = supabaseBrowser();
    async function sync(userId?: string) {
      requestedUser = userId;
      if (!userId) return;
      const { data } = await client
        .from("profiles")
        .select("locale")
        .eq("user_id", userId)
        .maybeSingle();
      if (!cancelled && requestedUser === userId && isLanguage(data?.locale))
        applyLanguage(data.locale);
    }
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (!cancelled) void sync(session?.user.id);
      });
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);
  const value = useMemo(() => makeValue(language), [language]);
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  return useContext(LanguageContext);
}
