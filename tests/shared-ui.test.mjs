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
