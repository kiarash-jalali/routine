import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { NotificationWorker } from "@/components/notifications/NotificationWorker";
import { AppFrame } from "@/components/AppFrame";
import { ViewTransitions } from "next-view-transitions";
import { MotionProvider } from "@/components/Motion";
import { LanguageProvider } from "@/components/preferences/LanguageProvider";
import { ThemeController } from "@/components/preferences/ThemeController";
import { isLanguage, languageCookieKey, languageScript } from "@/lib/i18n";
import { themeScript } from "@/lib/theme";
import "@fontsource-variable/fraunces/wght.css";
import "@fontsource-variable/vazirmatn/wght.css";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource/dm-mono/latin-400.css";
import "./globals.css";
import "./stability-polish.css";
import "./foundations.css";

export const metadata: Metadata = {
  title: "rootine",
  description: "A calm, routine-first way to shape each day.",
  applicationName: "rootine",
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    title: "rootine",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5ee" },
    { media: "(prefers-color-scheme: dark)", color: "#102825" },
  ],
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const cookieStore = await cookies();
  const savedLanguage = cookieStore.get(languageCookieKey)?.value;
  const language = isLanguage(savedLanguage) ? savedLanguage : "en";

  return (
    <ViewTransitions>
      <html lang={language} dir={language === "fa" ? "rtl" : "ltr"} suppressHydrationWarning>
        <head>
          <script
            nonce={nonce}
            dangerouslySetInnerHTML={{
              __html: themeScript + ";" + languageScript,
            }}
          />
        </head>
        <body className="antialiased">
          <LanguageProvider initialLanguage={language}>
            <ThemeController />
            <NotificationWorker />
            <MotionProvider>
              <AppFrame>{children}</AppFrame>
            </MotionProvider>
          </LanguageProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
