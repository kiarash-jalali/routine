import { pageMetadata } from "@/lib/server/pageMetadata";

export function generateMetadata() {
  return pageMetadata("nav.guide");
}

export default function GuideLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
