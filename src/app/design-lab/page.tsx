"use client";

import { Link } from "next-view-transitions";
import { Icon, type IconName } from "@/components/Icon";
import { PageHeader, PageShell } from "@/components/ui";

type ThemeName = "morning" | "day" | "evening" | "night";

type Theme = {
  label: string;
  icon: IconName;
  description: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
};

const themes: Record<ThemeName, Theme> = {
  morning: {
    label: "Morning",
    icon: "sun",
    description: "Warm first light and gentle contrast.",
    background: "#f8f4e9",
    surface: "#ffffff",
    text: "#263e36",
    muted: "#6c776f",
    primary: "#286e5e",
    accent: "#e6b86a",
  },
  day: {
    label: "Day",
    icon: "sun",
    description: "The default focused working environment.",
    background: "#f5f5ee",
    surface: "#ffffff",
    text: "#263e36",
    muted: "#607168",
    primary: "#286e5e",
    accent: "#8b5d26",
  },
  evening: {
    label: "Evening",
    icon: "clock",
    description: "Softer sunset colours for winding down.",
    background: "#f5ede5",
    surface: "#fffaf5",
    text: "#49352d",
    muted: "#816d62",
    primary: "#8c5a43",
    accent: "#d99152",
  },
  night: {
    label: "Night",
    icon: "moon",
    description: "Dark calm mode for late hours.",
    background: "#102825",
    surface: "#203e36",
    text: "#edf2e9",
    muted: "#b2c5b8",
    primary: "#a4ddbe",
    accent: "#f0c786",
  },
};

function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <article
      className="overflow-hidden rounded-[30px] border border-border shadow-lg"
      style={{ background: theme.background, color: theme.text }}
    >
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xl font-semibold">
              <Icon name={theme.icon} size={20} />
              {theme.label}
            </div>
            <p className="mt-1 text-sm" style={{ color: theme.muted }}>
              {theme.description}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div
            className="rounded-2xl p-4"
            style={{ background: theme.surface }}
          >
            <p className="font-semibold">Today</p>
            <p className="text-sm" style={{ color: theme.muted }}>
              Small progress every day.
            </p>
          </div>

          <div
            className="rounded-2xl p-4"
            style={{ background: theme.surface }}
          >
            <p className="font-semibold">3 routines completed</p>
            <div
              className="mt-3 h-2 rounded-full"
              style={{ background: theme.accent }}
            />
          </div>

          <button
            type="button"
            className="rounded-2xl px-4 py-2 font-semibold"
            style={{ background: theme.primary, color: theme.background }}
          >
            Action
          </button>
        </div>
      </div>
    </article>
  );
}

export default function DesignLabPage() {
  return (
    <PageShell className="max-w-[1500px]">
      <PageHeader
        eyebrow="Private design tool"
        title="Design lab"
        description="Compare every automatic Rootine theme together: morning, day, evening and night."
        actions={
          <Link href="/settings" className="btn">
            <Icon name="chevron" size={16} className="rotate-180" />
            Back
          </Link>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        {(Object.keys(themes) as ThemeName[]).map((name) => (
          <ThemePreview key={name} theme={themes[name]} />
        ))}
      </div>
    </PageShell>
  );
}
