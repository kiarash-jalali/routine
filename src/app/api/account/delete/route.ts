import { enforceRateLimit } from "@/lib/server/rateLimit";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type DeletePayload = {
  password?: unknown;
};

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Account deletion is not configured yet." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json(
      { error: "Your session is no longer valid." },
      { status: 401 },
    );
  }

  try {
    const allowed = await enforceRateLimit(
      admin,
      "account-delete",
      user.id,
      5,
      15 * 60,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many deletion attempts. Try again later." },
        { status: 429 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Account deletion is temporarily unavailable." },
      { status: 503 },
    );
  }

  let payload: DeletePayload;
  try {
    payload = (await request.json()) as DeletePayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const password = typeof payload.password === "string" ? payload.password : "";
  if (!password || password.length > 1024 || !user.email) {
    return NextResponse.json(
      { error: "Enter your current password to delete your account." },
      { status: 400 },
    );
  }

  const reauth = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: reauthData, error: reauthError } =
    await reauth.auth.signInWithPassword({
      email: user.email,
      password,
    });

  if (reauthError || !reauthData.user || reauthData.user.id !== user.id) {
    return NextResponse.json(
      { error: "Your current password is incorrect." },
      { status: 401 },
    );
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Your account could not be deleted. Try again in a moment." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
