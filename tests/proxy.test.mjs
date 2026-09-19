import assert from "node:assert/strict";
import test from "node:test";
import { unstable_doesProxyMatch } from "next/experimental/testing/server";
import { loadTypeScriptModule } from "./load-typescript.mjs";

const { config } = loadTypeScriptModule(
  new URL("../src/proxy.ts", import.meta.url),
  {
    "@/lib/supabase/proxy": {
      updateSession() {
        throw new Error("Proxy implementation should not execute in matcher tests.");
      },
    },
  },
);

test("auth proxy matches every protected app route", () => {
  const protectedPaths = [
    "/dashboard",
    "/routines/weekly",
    "/checkin",
    "/history",
    "/settings/profile",
    "/feedback",
    "/health",
    "/workouts",
    "/guide",
    "/onboarding",
  ];

  for (const pathname of protectedPaths) {
    assert.equal(
      unstable_doesProxyMatch({
        config,
        nextConfig: {},
        url: `https://routine.invalid${pathname}`,
      }),
      true,
      pathname,
    );
  }
});

test("auth proxy leaves public routes alone", () => {
  for (const pathname of ["/", "/login", "/forgot-password", "/reset-password"]) {
    assert.equal(
      unstable_doesProxyMatch({
        config,
        nextConfig: {},
        url: `https://routine.invalid${pathname}`,
      }),
      false,
      pathname,
    );
  }
});
