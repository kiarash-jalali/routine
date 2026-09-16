import type { Metadata, Viewport } from "next";
import { AppFrame } from "@/components/AppFrame";
import { ViewTransitions } from "next-view-transitions";
import { MotionProvider } from "@/components/Motion";
import { themeScript } from "@/lib/theme";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/dm-sans";
import "@fontsource/dm-mono/latin-400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routine Helper",
  description: "A calm, routine-first way to shape each day.",
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
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body className="antialiased">
          <MotionProvider>
            <AppFrame>{children}</AppFrame>
          </MotionProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
