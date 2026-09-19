import { authenticatePrivilegedRequest } from "@/lib/server/requestAuth";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type DeletePayload = {
  password?: unknown;
};

export async function POST(request: Request) {
  const auth = await authenticatePrivilegedRequest(request);

  if (!auth.ok) {
    if (auth.error === "server_unavailable") {
      return NextResponse.json(
        { error: "Account deletion is not configured yet." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error:
          auth.error === "not_authenticated"
            ? "Not authenticated."
            : "Your session is no longer valid.",
      },
      { status: 401 },
    );
  }

  const { accessToken, admin, anonKey, supabaseUrl, user } = auth;

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

  const { error: signOutError } = await admin.auth.admin.signOut(
    accessToken,
    "global",
  );

  if (signOutError) {
    return NextResponse.json(
      { error: "Your account sessions could not be closed. Try again in a moment." },
      { status: 500 },
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
