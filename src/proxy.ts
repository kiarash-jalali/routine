import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const protectedRoutes = [
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
] as const;

function isProtectedPath(pathname: string) {
  return protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isDesignLabPath(pathname: string) {
  return pathname === "/design-lab" || pathname.startsWith("/design-lab/");
}

function contentSecurityPolicy(nonce: string, pathname: string) {
  const development = process.env.NODE_ENV === "development";
  const loginFrameAncestors =
    "'self' https://kiarashjalali.net https://www.kiarashjalali.net http://localhost:5173 http://127.0.0.1:5173";
  const frameAncestors =
    pathname === "/login" ? loginFrameAncestors : "'none'";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // Dynamic theme previews and a few runtime layout values still use inline
    // styles. Keep this exception until those are moved to nonceable styles.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co${development ? " http: ws:" : ""}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const development = process.env.NODE_ENV === "development";
  const csp = contentSecurityPolicy(nonce, request.nextUrl.pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response: NextResponse;

  if (isDesignLabPath(request.nextUrl.pathname)) {
    if (!development) {
      response = new NextResponse(null, { status: 404 });
    } else {
      response = await updateSession(request, requestHeaders);
    }
  } else {
    response = isProtectedPath(request.nextUrl.pathname)
      ? await updateSession(request, requestHeaders)
      : NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set("Content-Security-Policy", csp);
  if (request.nextUrl.pathname === "/login") {
    response.headers.delete("X-Frame-Options");
  } else {
    response.headers.set("X-Frame-Options", "DENY");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|offline.html|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2|css|js)$).*)",
  ],
};
