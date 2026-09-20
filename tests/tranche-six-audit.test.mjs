import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Tranche 6 consolidates the design-system stylesheet and surface tokens", () => {
  assert.equal(fs.existsSync("src/app/stability-polish.css"), false);

  const layout = read("src/app/layout.tsx");
  const globals = read("src/app/globals.css");
  assert.doesNotMatch(layout, /stability-polish\.css/);
  assert.match(globals, /--surface-elevated:/);
  assert.match(globals, /--surface-sheen:/);
  assert.doesNotMatch(globals, /--glass(?:-|:)/);
});

test("theme period script and runtime share one period definition", () => {
  const theme = loadTypeScriptModule(
    new URL("../src/lib/theme.ts", import.meta.url),
  );

  for (let hour = 0; hour < 24; hour += 1) {
    const scripted = Function("h", `return ${theme.themePeriodExpression}`)(hour);
    assert.equal(scripted, theme.getThemePeriod(hour));
  }

  assert.equal(theme.resolveTheme("system", "day", true), "dark");
  assert.equal(theme.resolveTheme("system", "night", false), "light");
  assert.equal(theme.resolveTheme("auto", "night", false), "dark");
  assert.equal(theme.resolveTheme("auto", "day", true), "light");
  assert.match(theme.themeScript, new RegExp(`p=${theme.themePeriodExpression.replace(/[.*+?^$()|[\]\\]/g, "\\$&")},`));
});

test("database reads use explicit task and routine columns", () => {
  for (const path of ["src/lib/db/tasks.ts", "src/lib/db/routines.ts"]) {
    const source = read(path);
    assert.doesNotMatch(source, /\.select\(["']\*["']\)/);
  }
});

test("point economy has one database source of truth", () => {
  const domain = read("src/lib/points.ts");
  const history = read("src/app/history/HistoryClient.tsx");
  const migration = read(
    "supabase/migrations/20260920081104_centralize_point_economy_rules.sql",
  );

  assert.doesNotMatch(domain, /CHECKIN_REWARD_POINTS|STREAK_REPAIR_COST_POINTS/);
  assert.doesNotMatch(history, /CHECKIN_REWARD_POINTS|STREAK_REPAIR_COST_POINTS/);
  assert.match(migration, /create table if not exists public\.point_rules/);
  assert.match(migration, /get_point_rules/);
  assert.match(migration, /repair_cost/);
  assert.match(migration, /reward_points/);
});

test("maintenance guardrails and architecture docs are present", () => {
  const tsconfig = JSON.parse(read("tsconfig.json"));
  assert.equal(tsconfig.compilerOptions.target, "ES2022");
  assert.equal(tsconfig.compilerOptions.noUncheckedIndexedAccess, true);
  assert.equal(tsconfig.compilerOptions.exactOptionalPropertyTypes, true);
  assert.equal(tsconfig.compilerOptions.noImplicitOverride, true);
  assert.equal(tsconfig.compilerOptions.verbatimModuleSyntax, true);

  const eslint = read("eslint.config.mjs");
  assert.match(eslint, /react\/jsx-no-literals/);

  const readme = read("README.md");
  assert.match(readme, /\/health/);
  assert.match(readme, /\/workouts/);
  assert.match(readme, /\/design-lab/);
  assert.equal(fs.existsSync("docs/application-architecture.md"), true);
});
