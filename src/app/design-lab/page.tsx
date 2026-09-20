"use client";

import { useState } from "react";
import { Link } from "next-view-transitions";
import { BrandMark, Icon, type IconName } from "@/components/Icon";

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

const themeNames = Object.keys(defaultThemes) as ThemeName[];
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

function blend(color: string, amount: number) {
  return `color-mix(in srgb, ${color} ${amount}%, transparent)`;
}

function PreviewNavItem({
  icon,
  label,
  active = false,
  theme,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  theme: Theme;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium"
      style={{
        color: active ? theme.primary : theme.muted,
        background: active ? blend(theme.primary, 12) : "transparent",
      }}
    >
      <Icon name={icon} size={18} />
      <span>{label}</span>
    </div>
  );
}

function PreviewRow({
  title,
  detail,
  checked,
  theme,
}: {
  title: string;
  detail: string;
  checked?: boolean;
  theme: Theme;
}) {
  return (
    <div
      className="flex items-center gap-3 border-b py-4 last:border-b-0"
      style={{ borderColor: blend(theme.text, 12) }}
    >
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full border"
        style={{
          borderColor: checked ? theme.primary : blend(theme.text, 25),
          background: checked ? theme.primary : theme.surface,
          color: checked ? theme.background : theme.muted,
        }}
      >
        {checked && <Icon name="check" size={15} />}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-semibold"
          style={{
            textDecoration: checked ? "line-through" : "none",
            color: checked ? theme.muted : theme.text,
          }}
        >
          {title}
        </p>
        <p className="mt-1 text-xs" style={{ color: theme.muted }}>
          {detail}
        </p>
      </div>
      <Icon name="chevron" size={15} style={{ color: theme.muted }} />
    </div>
  );
}

function TodayPreview({ theme }: { theme: Theme }) {
  const border = blend(theme.text, 12);
  const softPrimary = blend(theme.primary, 12);
  const softAccent = blend(theme.accent, 18);

  return (
    <div className="min-h-dvh" style={{ background: theme.background }}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside
          className="hidden border-e p-5 lg:flex lg:flex-col"
          style={{
            background: blend(theme.surface, 84),
            borderColor: border,
          }}
        >
          <div className="mb-8 flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-lg font-semibold" style={{ color: theme.text }}>
                rootine
              </p>
              <p className="text-xs" style={{ color: theme.muted }}>
                shape your day
              </p>
            </div>
          </div>

          <nav className="space-y-1">
            <PreviewNavItem icon="today" label="Today" active theme={theme} />
            <PreviewNavItem icon="routines" label="Routines" theme={theme} />
            <PreviewNavItem icon="checkin" label="Check-in" theme={theme} />
            <PreviewNavItem icon="history" label="History" theme={theme} />
          </nav>

          <div className="mt-auto">
            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: border, background: blend(theme.surface, 76) }}
            >
              <div className="flex items-center gap-2">
                <Icon name={theme.icon} size={18} style={{ color: theme.accent }} />
                <span className="text-sm font-semibold" style={{ color: theme.text }}>
                  {theme.label}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5" style={{ color: theme.muted }}>
                {theme.description}
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div
            className="flex items-center justify-between border-b px-5 py-4 lg:hidden"
            style={{ borderColor: border, background: blend(theme.surface, 76) }}
          >
            <div className="flex items-center gap-2">
              <BrandMark />
              <span className="font-semibold" style={{ color: theme.text }}>
                rootine
              </span>
            </div>
            <div className="flex items-center gap-2" style={{ color: theme.accent }}>
              <Icon name={theme.icon} size={18} />
              <span className="text-xs font-semibold">{theme.label}</span>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[1160px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12 xl:pe-[360px]">
            <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p
                  className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]"
                  style={{ color: theme.muted }}
                >
                  Saturday, September 19
                </p>
                <h1
                  className="display-title text-5xl leading-none sm:text-6xl"
                  style={{ color: theme.text }}
                >
                  Today
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6" style={{ color: theme.muted }}>
                  Keep the day light. Finish what matters and let the rest wait.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm"
                style={{ background: theme.primary, color: theme.background }}
              >
                <Icon name="plus" size={17} />
                Add task
              </button>
            </header>

            <div
              className="mb-6 grid grid-cols-3 divide-x rounded-2xl border px-2 py-5 sm:px-4"
              style={{
                background: blend(theme.surface, 78),
                borderColor: border,
                borderInlineColor: border,
              }}
            >
              {[
                ["3", "routines today"],
                ["2", "open tasks"],
                ["6", "day rhythm"],
              ].map(([value, label]) => (
                <div key={label} className="px-3 sm:px-5">
                  <p className="data-text text-2xl" style={{ color: theme.text }}>
                    {value}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: theme.muted }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-6">
                <section
                  className="rounded-[24px] border p-5 shadow-sm sm:p-6"
                  style={{ background: theme.surface, borderColor: border }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold" style={{ color: theme.text }}>
                        Routines today
                      </p>
                      <p className="mt-1 text-xs" style={{ color: theme.muted }}>
                        Your anchors for the day
                      </p>
                    </div>
                    <span className="text-sm font-medium" style={{ color: theme.primary }}>
                      Manage
                    </span>
                  </div>
                  <PreviewRow
                    title="Morning walk"
                    detail="20 min · before 10:00"
                    checked
                    theme={theme}
                  />
                  <PreviewRow
                    title="Deep work"
                    detail="60 min · focus"
                    theme={theme}
                  />
                  <PreviewRow
                    title="Read"
                    detail="20 pages · evening"
                    checked
                    theme={theme}
                  />
                </section>

                <section
                  className="rounded-[24px] border p-5 shadow-sm sm:p-6"
                  style={{ background: theme.surface, borderColor: border }}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold" style={{ color: theme.text }}>
                        Tasks
                      </p>
                      <p className="mt-1 text-xs" style={{ color: theme.muted }}>
                        Today and overdue
                      </p>
                    </div>
                    <div
                      className="flex rounded-xl border p-1 text-xs"
                      style={{ borderColor: border, background: blend(theme.background, 55) }}
                    >
                      <span
                        className="rounded-lg px-3 py-1.5 font-semibold"
                        style={{ background: theme.surface, color: theme.text }}
                      >
                        Today
                      </span>
                      <span className="px-3 py-1.5" style={{ color: theme.muted }}>
                        All
                      </span>
                      <span className="px-3 py-1.5" style={{ color: theme.muted }}>
                        Done
                      </span>
                    </div>
                  </div>
                  <PreviewRow
                    title="Send project update"
                    detail="Due 14:30"
                    theme={theme}
                  />
                  <PreviewRow
                    title="Book dentist"
                    detail="Overdue · yesterday"
                    checked
                    theme={theme}
                  />
                </section>
              </div>

              <div className="space-y-6">
                <section
                  className="rounded-[24px] border p-5 shadow-sm"
                  style={{ background: theme.surface, borderColor: border }}
                >
                  <p className="text-sm font-semibold" style={{ color: theme.text }}>
                    This week
                  </p>
                  <div className="mt-5 grid grid-cols-7 gap-1.5">
                    {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                      <div key={`${day}-${index}`} className="text-center">
                        <span className="text-[10px]" style={{ color: theme.muted }}>
                          {day}
                        </span>
                        <div
                          className="mx-auto mt-2 grid h-7 w-7 place-items-center rounded-full text-[11px]"
                          style={{
                            background: index === 5 ? softPrimary : "transparent",
                            color: index === 5 ? theme.primary : theme.muted,
                          }}
                        >
                          {14 + index}
                        </div>
                        <span
                          className="mx-auto mt-2 block h-1.5 w-1.5 rounded-full"
                          style={{
                            background:
                              index < 5 ? theme.primary : index === 5 ? theme.accent : border,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <section
                  className="rounded-[24px] border p-5"
                  style={{ background: softAccent, borderColor: blend(theme.accent, 35) }}
                >
                  <div className="flex items-center gap-2" style={{ color: theme.accent }}>
                    <Icon name="spark" size={18} />
                    <p className="text-sm font-semibold">Daily check-in</p>
                  </div>
                  <p className="mt-3 text-sm leading-6" style={{ color: theme.text }}>
                    Two routines are already complete. Take a minute to finish the day.
                  </p>
                  <button
                    type="button"
                    className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold"
                    style={{ background: theme.primary, color: theme.background }}
                  >
                    Check in
                    <Icon name="arrow" size={16} />
                  </button>
                </section>

                <section
                  className="rounded-[24px] border p-5"
                  style={{
                    background: blend(theme.surface, 70),
                    borderColor: border,
                  }}
                >
                  <p className="text-sm font-semibold" style={{ color: theme.text }}>
                    Colour roles
                  </p>
                  <div className="mt-4 space-y-3 text-xs">
                    {[
                      ["Primary", theme.primary],
                      ["Accent", theme.accent],
                      ["Muted", theme.muted],
                    ].map(([label, color]) => (
                      <div key={label} className="flex items-center justify-between gap-3">
                        <span style={{ color: theme.muted }}>{label}</span>
                        <span className="flex items-center gap-2 font-mono" style={{ color: theme.text }}>
                          {color}
                          <span
                            className="h-4 w-4 rounded-full border"
                            style={{ background: color, borderColor: border }}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DesignLabPage() {
  // Theme edits in Design Lab stay local to this browser session.
  const [themes, setThemes] = useState(createEditableThemes);
  const [selected, setSelected] = useState<ThemeName>("day");
  const theme = themes[selected];

  function updateColor(color: ThemeColor, value: string) {
    setThemes((current) => ({
      ...current,
      [selected]: { ...current[selected], [color]: value },
    }));
  }

  function resetTheme() {
    setThemes((current) => ({
      ...current,
      [selected]: { ...defaultThemes[selected] },
    }));
  }

  return (
    <main id="main-content" className="relative min-h-dvh">
      <section className="grid min-h-[70dvh] place-items-center px-6 text-center lg:hidden">
        <div className="max-w-sm">
          <span className="icon-tile mx-auto mb-5">
            <Icon name="spark" size={22} />
          </span>
          <h1 className="display-title text-3xl">Design Lab needs a larger screen.</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Open this page on a desktop, laptop, or large tablet to edit and compare theme colours.
          </p>
          <Link href="/dashboard" className="btn btn-secondary mt-6 inline-flex">
            Back to Today
          </Link>
        </div>
      </section>

      <div className="hidden lg:block">
        <TodayPreview theme={theme} />

      <aside
        className="fixed inset-x-3 bottom-3 z-40 max-h-[48dvh] overflow-y-auto rounded-[24px] border p-4 shadow-2xl backdrop-blur-2xl sm:inset-x-auto sm:end-4 sm:top-4 sm:bottom-4 sm:w-[330px] sm:max-h-none sm:p-5"
        style={{
          color: theme.text,
          background: blend(theme.surface, 92),
          borderColor: blend(theme.text, 15),
          boxShadow: `0 24px 70px ${blend(theme.text, 18)}`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: theme.muted }}
            >
              Design Lab
            </p>
            <h2 className="mt-1 text-xl font-semibold">{theme.label} theme</h2>
            <p className="mt-1 text-xs leading-5" style={{ color: theme.muted }}>
              One full-screen Today preview. Changes reset on refresh.
            </p>
          </div>
          <Link
            href="/settings"
            aria-label="Back to settings"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
            style={{ borderColor: blend(theme.text, 14), color: theme.muted }}
          >
            <Icon name="close" size={17} />
          </Link>
        </div>

        <div
          className="mt-5 grid grid-cols-4 gap-1 rounded-xl border p-1"
          style={{
            borderColor: blend(theme.text, 12),
            background: blend(theme.background, 55),
          }}
        >
          {themeNames.map((name) => {
            const item = themes[name];
            const active = selected === name;
            return (
              <button
                key={name}
                type="button"
                aria-pressed={active}
                aria-label={`Preview ${item.label} theme`}
                onClick={() => setSelected(name)}
                className="flex min-h-10 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold"
                style={{
                  background: active ? item.surface : "transparent",
                  color: active ? item.text : theme.muted,
                  boxShadow: active ? `0 2px 10px ${blend(theme.text, 10)}` : "none",
                }}
              >
                <Icon name={item.icon} size={14} />
                <span className="hidden xl:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        <fieldset className="mt-5">
          <legend className="mb-2 text-xs font-semibold" style={{ color: theme.muted }}>
            Palette
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
            {colorFields.map((color) => (
              <label
                key={color}
                className="flex min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2"
                style={{ borderColor: blend(theme.text, 11), background: blend(theme.background, 30) }}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold capitalize">{color}</span>
                  <span
                    className="block truncate font-mono text-[10px]"
                    style={{ color: theme.muted }}
                  >
                    {theme[color]}
                  </span>
                </span>
                <input
                  type="color"
                  value={theme[color]}
                  aria-label={`${theme.label} ${color}`}
                  onChange={(event) => updateColor(color, event.target.value)}
                  className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1"
                  style={{ borderColor: blend(theme.text, 16) }}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="min-h-10 rounded-xl border px-3 text-xs font-semibold"
            style={{ borderColor: blend(theme.text, 15), color: theme.text }}
            onClick={resetTheme}
          >
            Reset {theme.label}
          </button>
          <button
            type="button"
            className="min-h-10 rounded-xl border px-3 text-xs font-semibold"
            style={{ borderColor: blend(theme.text, 15), color: theme.text }}
            onClick={() => setThemes(createEditableThemes())}
          >
            Reset all
          </button>
        </div>
      </aside>
      </div>
    </main>
  );
}
