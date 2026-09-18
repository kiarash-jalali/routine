import type { Metadata, Viewport } from "next";
import { NotificationWorker } from "@/components/notifications/NotificationWorker";
import { AppFrame } from "@/components/AppFrame";
import { ViewTransitions } from "next-view-transitions";
import { MotionProvider } from "@/components/Motion";
import { LanguageProvider } from "@/components/preferences/LanguageProvider";
import { ThemeController } from "@/components/preferences/ThemeController";
import { languageScript } from "@/lib/i18n";
import { themeScript } from "@/lib/theme";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/vazirmatn";
import "@fontsource-variable/dm-sans";
import "@fontsource/dm-mono/latin-400.css";
import "./globals.css";
import "./stability-polish.css";
import "./foundations.css";

export const metadata: Metadata = {
  title: "rootine",
  description: "A calm, routine-first way to shape each day.",
  applicationName: "rootine",
  manifest: "/manifest.webmanifest",
  formatDetection: {
    telephone: false,
  },
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitions>
      <html lang="en" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: themeScript + ";" + languageScript,
            }}
          />
        </head>
        <body className="antialiased">
          <LanguageProvider>
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
