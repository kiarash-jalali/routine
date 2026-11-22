import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("shared controls expose consistent size, busy and error states", () => {
  const ui = source("src/components/ui.tsx");
  const css = source("src/app/globals.css");

  assert.match(ui, /type ButtonSize = "sm" \| "md" \| "lg"/);
  assert.match(ui, /disabled=\{disabled \|\| busy\}/);
  assert.match(ui, /export function Textarea/);
  assert.match(ui, /aria-invalid=\{invalid \?\? ariaInvalid\}/);
  assert.match(ui, /aria-describedby=\{describedBy \?\? ariaDescribedBy\}/);
  assert.match(css, /\.field\[aria-invalid="true"\]/);
  assert.match(css, /\.btn-lg[\s\S]*min-height: 48px/);
});

test("segmented controls keep accessible touch targets and RTL motion", () => {
  const ui = source("src/components/ui.tsx");
  const css = source("src/app/globals.css");

  assert.match(ui, /aria-disabled=\{disabled \|\| undefined\}/);
  assert.match(css, /\.segmented button[\s\S]*min-height: 44px/);
  assert.match(css, /:root\[dir="rtl"\] \.segmented-indicator/);
});

test("shared form primitives replace one-off select and textarea styling", () => {
  const language = source("src/components/preferences/LanguagePicker.tsx");
  const medication = source("src/components/health/MedicationForm.tsx");
  const workout = source("src/components/workouts/WorkoutForm.tsx");
  const feedback = source("src/app/feedback/FeedbackClient.tsx");

  assert.match(language, /<Select/);
  assert.match(language, /describedBy=\{failed \? errorId : undefined\}/);
  assert.doesNotMatch(language, /<select/);

  for (const form of [medication, workout, feedback]) {
    assert.match(form, /<Textarea/);
    assert.doesNotMatch(form, /<textarea/);
  }
});

test("directional icons mirror in RTL without touching other icons", () => {
  const icon = source("src/components/Icon.tsx");
  const css = source("src/app/foundations.css");
  const settings = source("src/app/settings/SettingsClient.tsx");

  const directional = icon.match(/const directional = new Set<IconName>\(\[([^\]]*)\]\)/);
  assert.ok(directional, "Icon.tsx declares its directional icon set");
  for (const name of ["arrow", "chevron", "logout"]) {
    assert.match(directional[1], new RegExp(`["']${name}["']`));
  }
  assert.match(css, /\[dir="rtl"\] \.icon-directional > path[\s\S]*scaleX\(-1\)/);
  assert.match(settings, /rtl:group-open:-rotate-90/);
});
