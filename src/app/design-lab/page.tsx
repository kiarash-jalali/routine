"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "next-view-transitions";
import { BrandMark, Icon } from "@/components/Icon";
import { Button, PageHeader, PageShell } from "@/components/ui";

type PaletteMode = "light" | "dark";

type Palette = {
  background: string;
  surface: string;
  surfaceSoft: string;
  foreground: string;
  muted: string;
  primary: string;
  primarySoft: string;
  success: string;
  amber: string;
  danger: string;
};

type PaletteState = Record<PaletteMode, Palette>;

type PaletteKey = keyof Palette;

const STORAGE_KEY = "rootine-design-lab-v1";

const DEFAULT_PALETTES: PaletteState = {
  light: {
    background: "#f5f5ee",
    surface: "#ffffff",
    surfaceSoft: "#eaf0e9",
    foreground: "#263e36",
    muted: "#607168",
    primary: "#286e5e",
    primarySoft: "#dbeee3",
    success: "#327552",
    amber: "#8b5d26",
    danger: "#a44343",
  },
  dark: {
    background: "#102825",
    surface: "#203e36",
    surfaceSoft: "#2a483f",
    foreground: "#edf2e9",
    muted: "#b2c5b8",
    primary: "#a4ddbe",
    primarySoft: "#31574b",
    success: "#b3ddb4",
    amber: "#f0c786",
    danger: "#ffb3a8",
  },
};

const COLOR_FIELDS: ReadonlyArray<{
  key: PaletteKey;
  label: string;
  description: string;
}> = [
  { key: "background", label: "Background", description: "Main page canvas" },
  { key: "surface", label: "Surface", description: "Cards and sheets" },
  { key: "surfaceSoft", label: "Soft surface", description: "Inputs and secondary areas" },
  { key: "foreground", label: "Text", description: "Primary text and icons" },
  { key: "muted", label: "Muted text", description: "Descriptions and supporting copy" },
  { key: "primary", label: "Primary", description: "Main action and brand color" },
  { key: "primarySoft", label: "Primary soft", description: "Selected and highlighted areas" },
  { key: "success", label: "Success", description: "Completed and positive states" },
  { key: "amber", label: "Warm accent", description: "Energy, streaks and highlights" },
  { key: "danger", label: "Danger", description: "Delete and destructive actions" },
];

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function readableText(background: string) {
  const red = Number.parseInt(background.slice(1, 3), 16) / 255;
  const green = Number.parseInt(background.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(background.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.62 ? "#17372d" : "#ffffff";
}

function cssExport(palette: Palette) {
  return [
    `--background: ${palette.background};`,
    `--foreground: ${palette.foreground};`,
    `--surface: ${palette.surface};`,
    `--surface-soft: ${palette.surfaceSoft};`,
    `--muted: ${palette.muted};`,
    `--primary: ${palette.primary};`,
    `--primary-soft: ${palette.primarySoft};`,
    `--success: ${palette.success};`,
    `--amber: ${palette.amber};`,
    `--danger: ${palette.danger};`,
  ].join("\n");
}

export default function DesignLabPage() {
  const [mode, setMode] = useState<PaletteMode>("light");
  const [palettes, setPalettes] = useState<PaletteState>(DEFAULT_PALETTES);
  const [copied, setCopied] = useState(false);
  const storageReadyRef = useRef(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<PaletteState>;
          setPalettes({
            light: { ...DEFAULT_PALETTES.light, ...parsed.light },
            dark: { ...DEFAULT_PALETTES.dark, ...parsed.dark },
          });
        }
      } catch {
        // A malformed local draft should never make the design lab unusable.
      } finally {
        storageReadyRef.current = true;
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!storageReadyRef.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(palettes));
  }, [palettes]);

  const palette = palettes[mode];
  const onPrimary = useMemo(() => readableText(palette.primary), [palette.primary]);

  function updateColor(key: PaletteKey, value: string) {
    if (!isHexColor(value)) return;
    setPalettes((current) => ({
      ...current,
      [mode]: { ...current[mode], [key]: value.toLowerCase() },
    }));
  }

  function resetCurrentMode() {
    setPalettes((current) => ({
      ...current,
      [mode]: { ...DEFAULT_PALETTES[mode] },
    }));
  }

  async function copyPalette() {
    await navigator.clipboard.writeText(cssExport(palette));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const previewStyle = {
    "--lab-bg": palette.background,
    "--lab-surface": palette.surface,
    "--lab-surface-soft": palette.surfaceSoft,
    "--lab-text": palette.foreground,
    "--lab-muted": palette.muted,
    "--lab-primary": palette.primary,
    "--lab-primary-soft": palette.primarySoft,
    "--lab-success": palette.success,
    "--lab-amber": palette.amber,
    "--lab-danger": palette.danger,
    "--lab-on-primary": onPrimary,
  } as CSSProperties;

  return (
    <PageShell className="max-w-[1500px]">
      <PageHeader
        eyebrow="Private design tool"
        title="Design lab"
        description="Tune Rootine’s palette against real interface pieces instead of judging isolated color swatches. Your draft is saved only in this browser."
        actions={
          <Link href="/settings" className="btn">
            <Icon name="chevron" size={16} className="rotate-180" />
            Back to settings
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="segmented" style={{ "--segment-count": 2 } as CSSProperties}>
          <span
            className="segmented-indicator"
            aria-hidden="true"
            style={{ transform: `translateX(${mode === "dark" ? 100 : 0}%)` }}
          />
          <button
            type="button"
            aria-pressed={mode === "light"}
            onClick={() => setMode("light")}
          >
            Light
          </button>
          <button
            type="button"
            aria-pressed={mode === "dark"}
            onClick={() => setMode("dark")}
          >
            Dark
          </button>
        </div>
        <Button onClick={resetCurrentMode}>Reset {mode}</Button>
        <Button variant="primary" onClick={() => void copyPalette()}>
          <Icon name={copied ? "check" : "copy" as never} size={16} />
          {copied ? "Copied" : "Copy CSS"}
        </Button>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
        <section className="card p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">{mode === "light" ? "Light" : "Dark"} palette</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Change a swatch or type a six-digit hex color. The preview updates immediately.
            </p>
          </div>

          <div className="space-y-3">
            {COLOR_FIELDS.map((field) => (
              <div
                key={field.key}
                className="grid grid-cols-[46px_minmax(0,1fr)_108px] items-center gap-3 rounded-2xl border border-border bg-surface-soft p-3"
              >
                <label className="relative h-10 w-10 overflow-hidden rounded-xl border border-border shadow-sm">
                  <span className="sr-only">Choose {field.label}</span>
                  <input
                    type="color"
                    className="absolute -inset-2 h-14 w-14 cursor-pointer border-0 bg-transparent p-0"
                    value={palette[field.key]}
                    onChange={(event) => updateColor(field.key, event.target.value)}
                  />
                </label>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{field.label}</p>
                  <p className="truncate text-xs text-muted">{field.description}</p>
                </div>
                <input
                  aria-label={`${field.label} hex value`}
                  className="field h-10 min-h-0 px-2 font-mono text-xs uppercase"
                  value={palette[field.key]}
                  onChange={(event) => updateColor(field.key, event.target.value)}
                  maxLength={7}
                  spellCheck={false}
                />
              </div>
            ))}
          </div>
        </section>

        <section
          style={previewStyle}
          className="overflow-hidden rounded-[32px] border border-border shadow-[0_24px_90px_rgba(0,0,0,0.12)]"
        >
          <div
            className="min-h-[720px] p-4 sm:p-7 lg:p-10"
            style={{ background: "var(--lab-bg)", color: "var(--lab-text)" }}
          >
            <div className="mx-auto max-w-5xl">
              <div className="mb-8 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <BrandMark />
                  <div>
                    <p className="display-title text-2xl">rootine</p>
                    <p className="text-xs" style={{ color: "var(--lab-muted)" }}>
                      A little, every day.
                    </p>
                  </div>
                </div>
                <div
                  className="rounded-2xl px-3 py-2 text-sm"
                  style={{ background: "var(--lab-surface-soft)", color: "var(--lab-muted)" }}
                >
                  September 17
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm font-medium" style={{ color: "var(--lab-muted)" }}>
                  THURSDAY
                </p>
                <h1 className="display-title mt-1 text-5xl">Today</h1>
                <p className="mt-2" style={{ color: "var(--lab-muted)" }}>
                  A little progress, at your own pace.
                </p>
              </div>

              <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
                {[["3", "routines"], ["2", "open tasks"], ["6", "days in rhythm"]].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-2xl p-4 text-center"
                    style={{ background: "var(--lab-surface)" }}
                  >
                    <strong className="data-text text-2xl">{value}</strong>
                    <p className="mt-1 text-xs" style={{ color: "var(--lab-muted)" }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-5">
                  <div className="rounded-[26px] p-5 sm:p-6" style={{ background: "var(--lab-surface)" }}>
                    <div className="mb-5 flex items-center justify-between">
                      <h2 className="text-lg font-semibold">Tasks</h2>
                      <button
                        type="button"
                        className="rounded-xl px-4 py-2 text-sm font-semibold"
                        style={{ background: "var(--lab-primary)", color: "var(--lab-on-primary)" }}
                      >
                        + Add task
                      </button>
                    </div>
                    <div className="space-y-2">
                      {[
                        ["Reply to supervisor", "Today · 14:30", true],
                        ["Buy groceries", "Anytime", false],
                        ["Read for 20 minutes", "Tonight", false],
                      ].map(([title, detail, done]) => (
                        <div
                          key={String(title)}
                          className="flex items-center gap-3 rounded-2xl p-3.5"
                          style={{ background: done ? "var(--lab-primary-soft)" : "var(--lab-surface-soft)" }}
                        >
                          <span
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border"
                            style={{
                              borderColor: done ? "var(--lab-success)" : "var(--lab-muted)",
                              color: "var(--lab-success)",
                            }}
                          >
                            {done ? <Icon name="check" size={17} /> : null}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{String(title)}</p>
                            <p className="text-xs" style={{ color: "var(--lab-muted)" }}>
                              {String(detail)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl p-4" style={{ background: "var(--lab-primary-soft)" }}>
                      <p className="text-xs" style={{ color: "var(--lab-muted)" }}>Success</p>
                      <p className="mt-1 font-semibold" style={{ color: "var(--lab-success)" }}>Completed</p>
                    </div>
                    <div className="rounded-2xl p-4" style={{ background: "var(--lab-surface)" }}>
                      <p className="text-xs" style={{ color: "var(--lab-muted)" }}>Warm</p>
                      <p className="mt-1 font-semibold" style={{ color: "var(--lab-amber)" }}>6 day rhythm</p>
                    </div>
                    <div className="rounded-2xl p-4" style={{ background: "var(--lab-surface)" }}>
                      <p className="text-xs" style={{ color: "var(--lab-muted)" }}>Danger</p>
                      <p className="mt-1 font-semibold" style={{ color: "var(--lab-danger)" }}>Delete</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[26px] p-5" style={{ background: "var(--lab-primary-soft)" }}>
                    <span
                      className="grid h-11 w-11 place-items-center rounded-2xl"
                      style={{ background: "var(--lab-surface)", color: "var(--lab-primary)" }}
                    >
                      <Icon name="checkin" size={22} />
                    </span>
                    <h2 className="display-title mt-5 text-2xl">A moment for yourself.</h2>
                    <p className="mt-2 text-sm leading-6" style={{ color: "var(--lab-muted)" }}>
                      Take a breath and reflect on what happened today.
                    </p>
                    <button
                      type="button"
                      className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold"
                      style={{ background: "var(--lab-primary)", color: "var(--lab-on-primary)" }}
                    >
                      Check in today
                    </button>
                  </div>

                  <div
                    className="flex items-center gap-3 rounded-2xl border p-4 shadow-lg"
                    style={{
                      background: "var(--lab-surface)",
                      borderColor: "var(--lab-primary-soft)",
                    }}
                  >
                    <span
                      className="grid h-10 w-10 place-items-center rounded-xl"
                      style={{ background: "var(--lab-primary-soft)", color: "var(--lab-primary)" }}
                    >
                      <Icon name="spark" size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Tiny win.</p>
                      <p className="text-xs" style={{ color: "var(--lab-muted)" }}>
                        Your future self says thanks.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
