import type { MetadataRoute } from "next";
import { cookies } from "next/headers";
import {
  isLanguage,
  languageCookieKey,
  translate,
  type Language,
} from "@/lib/i18n";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const cookieStore = await cookies();
  const savedLanguage = cookieStore.get(languageCookieKey)?.value;
  const language: Language = isLanguage(savedLanguage) ? savedLanguage : "en";
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  return {
    name: "rootine",
    short_name: "rootine",
    description: t("pwa.appDescription"),
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f5ee",
    theme_color: "#286e5e",
    categories: ["productivity", "lifestyle"],
    shortcuts: [
      {
        name: t("nav.checkin"),
        short_name: t("nav.checkin"),
        description: t("pwa.checkinShortcut"),
        url: "/checkin",
        icons: [
          {
            src: "/pwa/icon-192",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: t("product.addTask"),
        short_name: t("product.addTask"),
        description: t("pwa.addTaskShortcut"),
        url: "/dashboard?newTask=1",
        icons: [
          {
            src: "/pwa/icon-192",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
    icons: [
      {
        src: "/pwa/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-maskable-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
