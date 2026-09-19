import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const { config } = loadTypeScriptModule(
  new URL("../src/proxy.ts", import.meta.url),
  {
    "@/lib/supabase/proxy": {
      updateSession() {
        throw new Error("Proxy implementation should not execute in config tests.");
      },
    },
  },
);

test("auth proxy declares every protected app route", () => {
  const proxy = source("src/proxy.ts");

  for (const pathname of [
    "/dashboard",
    "/routines",
    "/checkin",
    "/history",
    "/settings",
    "/feedback",
    "/health",
    "/workouts",
    "/guide",
    "/onboarding",
    "/design-lab",
  ]) {
    assert.match(proxy, new RegExp(`"${pathname.replaceAll("/", "\\/")}"`));
  }

  assert.deepEqual(config.matcher, [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2|css|js)$).*)",
  ]);
});

test("public auth routes receive CSP but are not authentication-gated", () => {
  const proxy = source("src/proxy.ts");
  const protectedBlock = proxy.slice(
    proxy.indexOf("const protectedRoutes"),
    proxy.indexOf("] as const"),
  );

  for (const pathname of ["/login", "/forgot-password", "/reset-password"]) {
    assert.equal(protectedBlock.includes(`"${pathname}"`), false, pathname);
  }

  assert.match(proxy, /Content-Security-Policy/);
});
