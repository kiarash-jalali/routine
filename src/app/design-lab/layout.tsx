import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DesignLabLayout({
  children,
}: {
  children: ReactNode;
}) {
  const vercelEnvironment = process.env.VERCEL_ENV ?? "production";
  const production =
    process.env.NODE_ENV === "production" && vercelEnvironment === "production";
  const explicitlyEnabled = process.env.DESIGN_LAB_ENABLED === "true";

  if (production && !explicitlyEnabled) notFound();
  return children;
}
