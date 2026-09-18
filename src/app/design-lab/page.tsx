"use client";

import { useState, type CSSProperties } from "react";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { PageHeader, PageShell } from "@/components/ui";

type PreviewTheme = "morning" | "day" | "evening" | "night";

type ThemePalette = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
};

const themes: Record<PreviewTheme, { label: string; icon: string; palette: ThemePalette }> = {
  morning: {
    label: "Morning",
    icon: "sun",
    palette: {
      background: "#f8f4e9",
      surface: "#ffffff",
      text: "#263e36",
      muted: "#6c776f",
      primary: "#286e5e",
      accent: "#e6b86a",
    },
  },
  day: {
    label: "Day",
    icon: "sun",
    palette: {
      background: "#f5f5ee",
      surface: "#ffffff",
      text: "#263e36",
      muted: "#607168",
      primary: "#286e5e",
      accent: "#8b5d26",
    },
  },
  evening: {
    label: "Evening",
    icon: "clock",
    palette: {
      background: "#f5ede5",
      surface: "#fffaf5",
      text: "#49352d",
      muted: "#816d62",
      primary: "#8c5a43",
      accent: "#d99152",
    },
  },
  night: {
    label: "Night",
    icon: "moon",
    palette: {
      background: "#102825",
      surface: "#203e36",
      text: "#edf2e9",
      muted: "#b2c5b8",
      primary: "#a4ddbe",
      accent: "#f0c786",
    },
  },
};

export default function DesignLabPage() {
  const [selected, setSelected] = useState<PreviewTheme>("day");
  const theme = themes[selected];
  const style = {
    "--lab-bg": theme.palette.background,
    "--lab-surface": theme.palette.surface,
    "--lab-text": theme.palette.text,
    "--lab-muted": theme.palette.muted,
    "--lab-primary": theme.palette.primary,
    "--lab-accent": theme.palette.accent,
  } as CSSProperties;

  return (
    <PageShell className="max-w-[1500px]">
      <PageHeader
        eyebrow="Private design tool"
        title="Design lab"
        description="Preview Rootine's complete automatic theme cycle: morning, day, evening and night."
        actions={
          <Link href="/settings" className="btn">
            <Icon name="chevron" size={16} className="rotate-180" />
            Back
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap gap-3">
        {(Object.keys(themes) as PreviewTheme[]).map((key) => (
          <button
            key={key}
            type="button"
            className="btn"
            onClick={() => setSelected(key)}
            aria-pressed={selected === key}
          >
            <Icon name={themes[key].icon} size={16} />
            {themes[key].label}
          </button>
        ))}
      </div>

      <section
        style={style}
        className="overflow-hidden rounded-[32px] border border-border shadow-lg"
      >
        <div className="min-h-[700px] p-6" style={{ background: "var(--lab-bg)", color: "var(--lab-text)" }}>
          <div className="grid gap-5 lg:grid-cols-3">
            {["Today", "Tasks", "Rhythm"].map((title) => (
              <div
                key={title}
                className="rounded-[28px] p-6"
                style={{ background: "var(--lab-surface)" }}
              >
                <h2 className="text-xl font-semibold">{title}</h2>
                <p className="mt-2 text-sm" style={{ color: "var(--lab-muted)" }}>
                  A calm preview of Rootine components.
                </p>
                <button
                  type="button"
                  className="mt-5 rounded-2xl px-4 py-2 font-semibold"
                  style={{ background: "var(--lab-primary)", color: "var(--lab-bg)" }}
                >
                  Action
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[28px] p-6" style={{ background: "var(--lab-surface)" }}>
            <h2 className="text-2xl font-semibold">{theme.label} theme</h2>
            <p className="mt-2" style={{ color: "var(--lab-muted)" }}>
              This represents the palette used by automatic theme mode.
            </p>
            <div className="mt-5 h-3 rounded-full" style={{ background: "var(--lab-accent)" }} />
          </div>
        </div>
      </section>
    </PageShell>
  );
}
