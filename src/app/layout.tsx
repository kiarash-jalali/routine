import type { Metadata, Viewport } from "next";
import { AppFrame } from "@/components/AppFrame";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routine Helper",
  description: "A calm, routine-first way to shape each day.",
};

export const viewport: Viewport = {
  themeColor: "#f5f6f8",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
