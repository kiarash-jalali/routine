import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isValidPushEndpoint } from "@/lib/pushEndpoint";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { supabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

const CATEGORIES = new Set(["checkin", "health", "workout", "meal_plan", "grocery"]);
// Event keys are built by the sender from a category and ids, e.g. "health:<uuid>:<bucket>".
const EVENT_KEY = /^[a-z][a-z-]*:[A-Za-z0-9:_.-]{1,190}$/;

/**
 * Records that a delivered reminder was opened (roadmap S7a). Called by the
 * service worker's notificationclick handler with the session cookie. The
 * endpoint only selects which of the user's own subscriptions the delivery
 * belongs to; it is never logged.
 */
export async function POST(request: Request) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "cross_origin" }, { status: 403 });
  }

  const db = await supabaseServer();
  const { data: claimsData, error: claimsError } = await db.auth.getClaims();
  const userId =
    typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (claimsError || !userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const allowed = await enforceRateLimit(admin, "notification-opened", userId, 30, 60);
    if (!allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  let payload: { eventKey?: unknown; category?: unknown; endpoint?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { eventKey, category, endpoint } = payload ?? {};
  if (
    typeof eventKey !== "string" ||
    !EVENT_KEY.test(eventKey) ||
    typeof category !== "string" ||
    !CATEGORIES.has(category) ||
    !isValidPushEndpoint(endpoint)
  ) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { data: subscription, error: subscriptionError } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (subscriptionError) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  // Unknown device or someone else's endpoint: nothing to record.
  if (!subscription) return NextResponse.json({ ok: true, recorded: false });

  const { data, error } = await admin
    .from("push_deliveries")
    .update({ opened_at: new Date().toISOString() })
    .eq("subscription_id", subscription.id)
    .eq("category", category)
    .eq("event_key", eventKey)
    .not("delivered_at", "is", null)
    .is("opened_at", null)
    .select("event_key");
  if (error) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, recorded: (data?.length ?? 0) > 0 });
}
