import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SubscriptionPayload = {
  endpoint?: unknown;
  p256dh?: unknown;
  auth?: unknown;
};

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getAccessToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
}

async function getAuthenticatedUser(request: Request) {
  const admin = getAdminClient();
  if (!admin) {
    return {
      error: NextResponse.json(
        { error: "Push notifications are not configured on the server." },
        { status: 503 },
      ),
      admin: null,
      user: null,
    };
  }

  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return {
      error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
      admin,
      user: null,
    };
  }

  const {
    data: { user },
    error,
  } = await admin.auth.getUser(accessToken);

  if (error || !user) {
    return {
      error: NextResponse.json(
        { error: "Your session is no longer valid." },
        { status: 401 },
      ),
      admin,
      user: null,
    };
  }

  return { error: null, admin, user };
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error || !auth.admin || !auth.user) return auth.error;

  let payload: SubscriptionPayload;
  try {
    payload = (await request.json()) as SubscriptionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { endpoint, p256dh, auth: authKey } = payload;
  if (
    typeof endpoint !== "string" ||
    typeof p256dh !== "string" ||
    typeof authKey !== "string" ||
    !endpoint ||
    !p256dh ||
    !authKey
  ) {
    return NextResponse.json(
      { error: "Incomplete push subscription." },
      { status: 400 },
    );
  }

  // A browser push endpoint belongs to the device/service-worker subscription,
  // not permanently to one Routine account. If another account previously used
  // the same installed PWA, transfer that endpoint to the currently authenticated
  // user instead of letting RLS block the client-side upsert.
  const { error } = await auth.admin.from("push_subscriptions").upsert(
    {
      user_id: auth.user.id,
      endpoint,
      p256dh,
      auth: authKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json(
      { error: "The push subscription could not be saved." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error || !auth.admin || !auth.user) return auth.error;

  let payload: { endpoint?: unknown };
  try {
    payload = (await request.json()) as { endpoint?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof payload.endpoint !== "string" || !payload.endpoint) {
    return NextResponse.json({ error: "Missing push endpoint." }, { status: 400 });
  }

  const { error } = await auth.admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", payload.endpoint)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json(
      { error: "The push subscription could not be removed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
