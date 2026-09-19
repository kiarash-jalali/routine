import { en, type TranslationKey } from "./en";
import { fa } from "./fa";

export type Language = "en" | "fa";
export const languageStorageKey = "rootine-language";
export const languageCookieKey = "rootine-language";
export const locales: Record<Language, string> = { en: "en-AU", fa: "fa-IR" };

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "fa";
}

export function translate(
  language: Language,
  key: TranslationKey,
  values?: Record<string, string | number>,
): string {
  const text: string = (language === "fa" ? fa[key] : en[key]) ?? en[key];
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    String(values?.[name] ?? match),
  );
}

export function languageScript(initialLanguage: Language) {
  return "(()=>{let l='" +
    initialLanguage +
    "';const hasCookie=document.cookie.split(';').some(v=>v.trim().startsWith('" +
    languageCookieKey +
    "='));if(!hasCookie){try{const s=localStorage.getItem('" +
    languageStorageKey +
    "');if(s==='fa'||s==='en')l=s}catch{}}document.documentElement.lang=l;document.documentElement.dir=l==='fa'?'rtl':'ltr'})()";
}

export type { TranslationKey };
