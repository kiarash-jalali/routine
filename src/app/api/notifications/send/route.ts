import { enforceRateLimit, requestIp } from "@/lib/server/rateLimit";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { reminderDelivery } from "@/lib/server/reminderDelivery";
import { localClock } from "@/lib/schedule";

export const runtime = "nodejs";
export const maxDuration = 60;

type PreferenceRow = {
  user_id: string;
  reminder_time: string;
  timezone: string;
  last_sent_on: string | null;
};

type DuePreference = {
  preference: PreferenceRow;
  clock: ReturnType<typeof localClock>;
};

async function runInChunks<T>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<void>,
) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.allSettled(items.slice(index, index + size).map(worker));
  }
}

export async function POST(request: Request) {
  const expected = process.env.NOTIFICATION_CRON_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (
    !expected ||
    !supplied ||
    Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  ) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !url ||
    !key ||
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY ||
    !process.env.VAPID_SUBJECT
  ) {
    return NextResponse.json(
      { error: "Notifications are not configured." },
      { status: 503 },
    );
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const allowed = await enforceRateLimit(
      admin,
      "notification-cron",
      requestIp(request),
      12,
      60,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many scheduler requests." },
        { status: 429 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Reminder rate limiting is unavailable." },
      { status: 503 },
    );
  }

  const { counts, deliver } = reminderDelivery(admin);
  const now = new Date();
  let skippedCheckedIn = 0;

  const { data: preferences, error } = await admin
    .from("notification_preferences")
    .select("user_id,reminder_time,timezone,last_sent_on")
    .eq("enabled", true);

  if (error) {
    return NextResponse.json(
      { error: "Reminders could not be loaded." },
      { status: 500 },
    );
  }

  const duePreferences: DuePreference[] = [];
  for (const preference of (preferences ?? []) as PreferenceRow[]) {
    try {
      const clock = localClock(now, preference.timezone);
      if (
        clock.time >= preference.reminder_time.slice(0, 5) &&
        preference.last_sent_on !== clock.day
      ) {
        duePreferences.push({ preference, clock });
      }
    } catch {
      counts.failed++;
    }
  }

  for (let index = 0; index < duePreferences.length; index += 100) {
    const batch = duePreferences.slice(index, index + 100);
    const userIds = [
      ...new Set(batch.map(({ preference }) => preference.user_id)),
    ];
    const days = [...new Set(batch.map(({ clock }) => clock.day))];

    const { data: checkins, error: checkinError } = await admin
      .from("daily_checkins")
      .select("user_id,day")
      .in("user_id", userIds)
      .in("day", days)
      .not("completed_at", "is", null);

    if (checkinError) {
      counts.failed += batch.length;
      continue;
    }

    const checkedIn = new Set(
      (checkins ?? []).map((row) => `${row.user_id}:${row.day}`),
    );

    await runInChunks(batch, 25, async ({ preference, clock }) => {
      const hasCheckin = checkedIn.has(
        `${preference.user_id}:${clock.day}`,
      );
      if (hasCheckin) skippedCheckedIn++;

      const handled =
        hasCheckin ||
        (await deliver(preference.user_id, "checkin", clock.day));

      if (!handled) return;

      const { error: updateError } = await admin
        .from("notification_preferences")
        .update({
          last_sent_on: clock.day,
          updated_at: now.toISOString(),
        })
        .eq("user_id", preference.user_id);

      if (updateError) counts.failed++;
    });
  }

  const { error: syncError } = await admin.rpc("sync_medication_reminders");
  if (syncError) {
    return NextResponse.json(
      { error: "Scheduled reminders could not be prepared." },
      { status: 500 },
    );
  }

  const { data: healthRows, error: healthError } = await admin
    .from("medication_reminders")
    .select("id,user_id,medication_plans!inner(is_active,reminders_enabled)")
    .is("taken_at", null)
    .is("notified_at", null)
    .eq("medication_plans.is_active", true)
    .eq("medication_plans.reminders_enabled", true)
    .lte("scheduled_at", now.toISOString())
    .gte(
      "scheduled_at",
      new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    )
    .order("scheduled_at")
    .limit(100);

  if (healthError) counts.failed++;
  await runInChunks(
    (healthRows ?? []) as Array<{ id: string; user_id: string }>,
    25,
    async (reminder) => {
      if (await deliver(reminder.user_id, "health", reminder.id)) {
        const { error: updateError } = await admin
          .from("medication_reminders")
          .update({ notified_at: now.toISOString() })
          .eq("id", reminder.id);
        if (updateError) counts.failed++;
      }
    },
  );

  const { error: workoutSyncError } = await admin.rpc("sync_workout_sessions");
  if (workoutSyncError) {
    return NextResponse.json(
      { error: "Scheduled sessions could not be prepared." },
      { status: 500 },
    );
  }

  const { data: workoutRows, error: workoutError } = await admin
    .from("workout_sessions")
    .select("id,user_id,workout_plans!inner(is_active,reminders_enabled)")
    .is("completed_at", null)
    .is("notified_at", null)
    .eq("workout_plans.is_active", true)
    .eq("workout_plans.reminders_enabled", true)
    .lte("scheduled_at", now.toISOString())
    .gte(
      "scheduled_at",
      new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    )
    .order("scheduled_at")
    .limit(100);

  if (workoutError) counts.failed++;
  await runInChunks(
    (workoutRows ?? []) as Array<{ id: string; user_id: string }>,
    25,
    async (session) => {
      if (await deliver(session.user_id, "workout", session.id)) {
        const { error: updateError } = await admin
          .from("workout_sessions")
          .update({ notified_at: now.toISOString() })
          .eq("id", session.id);
        if (updateError) counts.failed++;
      }
    },
  );

  await admin
    .from("push_deliveries")
    .delete()
    .lt(
      "attempted_at",
      new Date(now.getTime() - 30 * 86400000).toISOString(),
    );

  return NextResponse.json({
    ok: counts.failed === 0,
    ...counts,
    skippedCheckedIn,
  });
}
