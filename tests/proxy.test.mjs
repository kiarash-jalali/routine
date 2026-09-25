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

test("auth proxy protects app routes while leaving public PWA resources reachable", () => {
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
  ]) {
    assert.match(proxy, new RegExp(`"${pathname.replaceAll("/", "\\/")}"`));
  }

  assert.deepEqual(config.matcher, [
    "/((?!api|_next/static|_next/image|favicon.ico|offline.html|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2|css|js)$).*)",
  ]);
});

test("Design Lab is development-only and production returns 404", () => {
  const proxy = source("src/proxy.ts");
  const nav = source("src/components/AppNav.tsx");

  assert.match(proxy, /function isDesignLabPath/);
  assert.match(proxy, /if \(!development\)[\s\S]*status: 404/);
  assert.doesNotMatch(
    proxy.slice(proxy.indexOf("const protectedRoutes"), proxy.indexOf("] as const")),
    /"\/design-lab"/,
  );
  assert.match(nav, /process\.env\.NODE_ENV !== "production"/);
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
