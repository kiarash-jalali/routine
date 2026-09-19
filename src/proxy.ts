import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
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
  ],
};
