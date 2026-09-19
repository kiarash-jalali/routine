import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("server locale is cookie-backed before hydration", () => {
  const layout = source("src/app/layout.tsx");
  const provider = source("src/components/preferences/LanguageProvider.tsx");
  const i18n = source("src/lib/i18n/index.ts");

  assert.match(layout, /cookies\(\)/);
  assert.match(layout, /lang=\{initialLanguage\}/);
  assert.match(layout, /dir=\{direction\}/);
  assert.match(layout, /initialLanguage=\{initialLanguage\}/);
  assert.match(provider, /languageCookieKey/);
  assert.match(provider, /SameSite=Lax/);
  assert.match(i18n, /languageScript\(initialLanguage/);
});

test("theme preference is an explicit three-way control", () => {
  const picker = source("src/components/preferences/ThemePicker.tsx");
  assert.match(picker, /SegmentedControl/);
  assert.match(picker, /value: "auto"/);
  assert.match(picker, /value: "light"/);
  assert.match(picker, /value: "dark"/);
  assert.doesNotMatch(picker, /function cycle/);
});

test("Persian deletion confirmation uses the localized keyword", () => {
  const settings = source("src/app/settings/SettingsClient.tsx");
  const fa = source("src/lib/i18n/fa.ts");
  assert.match(settings, /deleteKeyword = t\("settings\.deleteKeyword"\)/);
  assert.match(settings, /deleteConfirmation\.trim\(\) !== deleteKeyword/);
  assert.match(fa, /"settings\.deleteKeyword": "حذف"/);
});

test("accessibility and RTL polish remove known audit defects", () => {
  const ui = source("src/components/ui.tsx");
  const globals = source("src/app/globals.css");
  const polish = source("src/app/stability-polish.css");
  const routines = source("src/app/routines/RoutinesClient.tsx");

  assert.match(ui, /t\("common\.completion"\)/);
  assert.doesNotMatch(ui, /aria-label="Completion"/);
  assert.match(globals, /--muted-soft: #5f7066/);
  assert.match(polish, /font-size: 11px/);
  assert.doesNotMatch(polish, /text-align: left/);
  assert.doesNotMatch(routines, /aria-label=\{\`Edit|Delete routine|will be removed/);
});
