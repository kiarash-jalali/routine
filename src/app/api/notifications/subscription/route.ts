import { isValidPushEndpoint as isValidEndpoint } from "@/lib/pushEndpoint";
import {
  authenticatePrivilegedRequest,
  type RequestAuthFailure,
} from "@/lib/server/requestAuth";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SubscriptionPayload = {
  endpoint?: unknown;
  p256dh?: unknown;
  auth?: unknown;
};

function isValidSubscriptionKey(
  value: unknown,
  maximumLength: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximumLength
  );
}

function authErrorResponse(error: RequestAuthFailure) {
  if (error === "server_unavailable") {
    return NextResponse.json(
      { error: "Push notifications are not configured on the server." },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      error:
        error === "not_authenticated"
          ? "Not authenticated."
          : "Your session is no longer valid.",
    },
    { status: 401 },
  );
}

export async function POST(request: Request) {
  const auth = await authenticatePrivilegedRequest(request);
  if (!auth.ok) return authErrorResponse(auth.error);

  try {
    const allowed = await enforceRateLimit(
      auth.admin,
      "push-subscription",
      auth.user.id,
      20,
      60,
    );
    if (!allowed)
      return NextResponse.json(
        { error: "Too many subscription changes. Try again shortly." },
        { status: 429 },
      );
  } catch {
    return NextResponse.json(
      { error: "Push subscriptions are temporarily unavailable." },
      { status: 503 },
    );
  }

  let payload: SubscriptionPayload;
  try {
    payload = (await request.json()) as SubscriptionPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  const { endpoint, p256dh, auth: authKey } = payload;
  if (
    !isValidEndpoint(endpoint) ||
    !isValidSubscriptionKey(p256dh, 512) ||
    !isValidSubscriptionKey(authKey, 256)
  ) {
    return NextResponse.json(
      { error: "Invalid push subscription." },
      { status: 400 },
    );
  }

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
  const auth = await authenticatePrivilegedRequest(request);
  if (!auth.ok) return authErrorResponse(auth.error);

  try {
    const allowed = await enforceRateLimit(
      auth.admin,
      "push-subscription",
      auth.user.id,
      20,
      60,
    );
    if (!allowed)
      return NextResponse.json(
        { error: "Too many subscription changes. Try again shortly." },
        { status: 429 },
      );
  } catch {
    return NextResponse.json(
      { error: "Push subscriptions are temporarily unavailable." },
      { status: 503 },
    );
  }

  let payload: { endpoint?: unknown };
  try {
    payload = (await request.json()) as { endpoint?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (!payload || !isValidEndpoint(payload.endpoint)) {
    return NextResponse.json(
      { error: "Invalid push endpoint." },
      { status: 400 },
    );
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
