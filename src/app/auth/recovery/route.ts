import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const tokenHash = request.nextUrl.searchParams.get("token_hash");

  if (!supabaseUrl || !supabaseAnonKey || !tokenHash) {
    return NextResponse.redirect(new URL("/reset-password", request.url));
  }

  const response = NextResponse.redirect(
    new URL("/reset-password", request.url),
  );

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (error) {
    return NextResponse.redirect(new URL("/reset-password", request.url));
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
