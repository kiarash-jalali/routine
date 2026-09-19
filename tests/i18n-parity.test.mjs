import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function keys(path) {
  return [...source(path).matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1]);
}

test("English and Persian translation dictionaries stay in parity", () => {
  const en = new Set(keys("src/lib/i18n/en.ts"));
  const fa = new Set(keys("src/lib/i18n/fa.ts"));
  assert.deepEqual([...en].sort(), [...fa].sort());
});

test("key Tranche 4 pages avoid physical Tailwind margins", () => {
  for (const path of [
    "src/app/dashboard/DashboardClient.tsx",
    "src/app/routines/RoutinesClient.tsx",
  ]) {
    const content = source(path);
    assert.doesNotMatch(content, /(?:^|\s)-?m[lr]-\d/);
    assert.doesNotMatch(content, /(?:^|\s)-?p[lr]-\d/);
  }
});
