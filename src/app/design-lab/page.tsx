"use client";

import { useState } from "react";
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

const defaultThemes: Readonly<Record<ThemeName, Readonly<Theme>>> = {
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

const colorFields = [
  "background",
  "surface",
  "text",
  "muted",
  "primary",
  "accent",
] as const;

type ThemeColor = (typeof colorFields)[number];

function createEditableThemes(): Record<ThemeName, Theme> {
  return {
    morning: { ...defaultThemes.morning },
    day: { ...defaultThemes.day },
    evening: { ...defaultThemes.evening },
    night: { ...defaultThemes.night },
  };
}

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
  const [themes, setThemes] = useState(createEditableThemes);

  function updateColor(name: ThemeName, color: ThemeColor, value: string) {
    setThemes((current) => ({
      ...current,
      [name]: { ...current[name], [color]: value },
    }));
  }

  function resetTheme(name: ThemeName) {
    setThemes((current) => ({
      ...current,
      [name]: { ...defaultThemes[name] },
    }));
  }

  return (
    <PageShell className="max-w-[1500px]">
      <PageHeader
        eyebrow="Developer preview tool"
        title="Design lab"
        description="Experiment with all four theme palettes. Changes affect only these previews and disappear after refresh."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => setThemes(createEditableThemes())}
            >
              Reset all themes
            </button>
            <Link href="/settings" className="btn">
              <Icon name="chevron" size={16} className="rotate-180" />
              Back
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        {(Object.keys(themes) as ThemeName[]).map((name) => (
          <section key={name} className="min-w-0 space-y-4">
            <ThemePreview theme={themes[name]} />
            <fieldset className="rounded-2xl border border-border p-4">
              <legend className="px-2 font-semibold">
                {themes[name].label} colors
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {colorFields.map((color) => (
                  <label
                    key={color}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="capitalize">{color}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs">
                        {themes[name][color]}
                      </span>
                      <input
                        type="color"
                        value={themes[name][color]}
                        aria-label={`${themes[name].label} ${color}`}
                        onChange={(event) =>
                          updateColor(name, color, event.target.value)
                        }
                        className="h-10 w-12 cursor-pointer rounded border border-border bg-transparent p-1"
                      />
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="btn mt-4"
                onClick={() => resetTheme(name)}
              >
                Reset {themes[name].label.toLowerCase()} theme
              </button>
            </fieldset>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
