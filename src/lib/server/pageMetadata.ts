import "server-only";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  isLanguage,
  languageCookieKey,
  translate,
  type TranslationKey,
} from "@/lib/i18n";

/** Localized page title; the root layout appends " · rootine". */
export async function pageMetadata(titleKey: TranslationKey): Promise<Metadata> {
  const saved = (await cookies()).get(languageCookieKey)?.value;
  const language = isLanguage(saved) ? saved : "en";
  return { title: translate(language, titleKey) };
}
