import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routine Helper",
  description: "A calm, routine-first way to shape each day.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
