import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { enforceRateLimit, requestIp } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

type ErrorReport = {
  digest?: unknown;
  fingerprint?: unknown;
  name?: unknown;
  pathname?: unknown;
};

function boundedString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length <= maxLength
    ? value
    : undefined;
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return new NextResponse(null, { status: 204 });

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const [ipAllowed, globalAllowed] = await Promise.all([
      enforceRateLimit(
        admin,
        "client-error-report",
        requestIp(request),
        20,
        60,
      ),
      enforceRateLimit(
        admin,
        "client-error-report-global",
        "global",
        120,
        60,
      ),
    ]);
    if (!ipAllowed || !globalAllowed) {
      return new NextResponse(null, { status: 204 });
    }
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  let payload: ErrorReport;
  try {
    payload = (await request.json()) as ErrorReport;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const report = {
    kind: "client_error",
    digest: boundedString(payload.digest, 128),
    fingerprint: boundedString(payload.fingerprint, 64),
    name: boundedString(payload.name, 80),
    pathname: boundedString(payload.pathname, 256),
    deployment: process.env.VERCEL_GIT_COMMIT_SHA,
  };

  console.error(JSON.stringify(report));
  return new NextResponse(null, { status: 204 });
}
