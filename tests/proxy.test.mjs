import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./load-typescript.mjs";

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
  assert.deepEqual(config.matcher, [
    "/dashboard/:path*",
    "/routines/:path*",
    "/checkin/:path*",
    "/history/:path*",
    "/settings/:path*",
    "/feedback/:path*",
    "/health/:path*",
    "/workouts/:path*",
    "/guide/:path*",
    "/onboarding/:path*",
  ]);
});

test("auth proxy does not include public auth routes", () => {
  const matchers = config.matcher.join("\n");
  for (const pathname of ["/login", "/forgot-password", "/reset-password"]) {
    assert.equal(matchers.includes(pathname), false, pathname);
  }
});
