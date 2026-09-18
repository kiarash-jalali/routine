import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { reminderDelivery } from "@/lib/server/reminderDelivery";
import { localClock } from "@/lib/schedule";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const expected = process.env.NOTIFICATION_CRON_SECRET,
    supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (
    !expected ||
    !supplied ||
    Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  )
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !url ||
    !key ||
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY ||
    !process.env.VAPID_SUBJECT
  )
    return NextResponse.json(
      { error: "Notifications are not configured." },
      { status: 503 },
    );
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { counts, deliver } = reminderDelivery(admin);
  const now = new Date();
  let skippedCheckedIn = 0;
  const { data: preferences, error } = await admin
    .from("notification_preferences")
    .select("user_id,reminder_time,timezone,last_sent_on")
    .eq("enabled", true);
  if (error)
    return NextResponse.json(
      { error: "Reminders could not be loaded." },
      { status: 500 },
    );
  for (const preference of preferences ?? []) {
    let clock;
    try {
      clock = localClock(now, preference.timezone);
    } catch {
      counts.failed++;
      continue;
    }
    if (
      clock.time < preference.reminder_time.slice(0, 5) ||
      preference.last_sent_on === clock.day
    )
      continue;
    const { data: checkin, error } = await admin
      .from("daily_checkins")
      .select("id")
      .eq("user_id", preference.user_id)
      .eq("day", clock.day)
      .maybeSingle();
    if (error) {
      counts.failed++;
      continue;
    }
    if (checkin) skippedCheckedIn++;
    if (checkin || (await deliver(preference.user_id, "checkin", clock.day))) {
      const { error } = await admin
        .from("notification_preferences")
        .update({ last_sent_on: clock.day, updated_at: now.toISOString() })
        .eq("user_id", preference.user_id);
      if (error) counts.failed++;
    }
  }
  const { error: syncError } = await admin.rpc("sync_medication_reminders");
  if (syncError)
    return NextResponse.json(
      { error: "Scheduled reminders could not be prepared." },
      { status: 500 },
    );
  const { data: health, error: healthError } = await admin
    .from("medication_reminders")
    .select("id,user_id,medication_plans!inner(is_active,reminders_enabled)")
    .is("taken_at", null)
    .is("notified_at", null)
    .eq("medication_plans.is_active", true)
    .eq("medication_plans.reminders_enabled", true)
    .lte("scheduled_at", now.toISOString())
    .gte("scheduled_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString())
    .order("scheduled_at")
    .limit(100);
  if (healthError) counts.failed++;
  for (const reminder of health ?? []) {
    if (await deliver(reminder.user_id, "health", reminder.id)) {
      const { error } = await admin
        .from("medication_reminders")
        .update({ notified_at: now.toISOString() })
        .eq("id", reminder.id);
      if (error) counts.failed++;
    }
  }
  const { error: workoutSyncError } = await admin.rpc("sync_workout_sessions");
  if (workoutSyncError)
    return NextResponse.json(
      { error: "Scheduled sessions could not be prepared." },
      { status: 500 },
    );
  const { data: workouts, error: workoutError } = await admin
    .from("workout_sessions")
    .select("id,user_id,workout_plans!inner(is_active,reminders_enabled)")
    .is("completed_at", null)
    .is("notified_at", null)
    .eq("workout_plans.is_active", true)
    .eq("workout_plans.reminders_enabled", true)
    .lte("scheduled_at", now.toISOString())
    .gte("scheduled_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString())
    .order("scheduled_at")
    .limit(100);
  if (workoutError) counts.failed++;
  for (const session of workouts ?? []) {
    if (await deliver(session.user_id, "workout", session.id)) {
      const { error } = await admin
        .from("workout_sessions")
        .update({ notified_at: now.toISOString() })
        .eq("id", session.id);
      if (error) counts.failed++;
    }
  }
  // Transport metadata has no product-history purpose beyond a short retry window.
  await admin
    .from("push_deliveries")
    .delete()
    .lt("attempted_at", new Date(now.getTime() - 30 * 86400000).toISOString());
  return NextResponse.json({
    ok: counts.failed === 0,
    ...counts,
    skippedCheckedIn,
  });
}
