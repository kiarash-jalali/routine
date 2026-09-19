import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export default function DesignLabLayout({
  children,
}: {
  children: ReactNode;
}) {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const isVercelPreview = process.env.VERCEL_ENV === "preview";

  if (!isDevelopment && !isVercelPreview) notFound();

  return children;
}
