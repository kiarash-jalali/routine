import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmptyPush } from "@/lib/server/webPush";

export const runtime = "nodejs";

type Preference = {
  user_id: string;
  reminder_time: string;
  timezone: string;
  last_sent_on: string | null;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
};

function getLocalClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function isReminderDue(preference: Preference, now: Date) {
  try {
    const local = getLocalClock(now, preference.timezone);
    const reminder = preference.reminder_time.slice(0, 5);
    return {
      due: local.time >= reminder && preference.last_sent_on !== local.date,
      localDate: local.date,
    };
  } catch {
    const local = getLocalClock(now, "UTC");
    const reminder = preference.reminder_time.slice(0, 5);
    return {
      due: local.time >= reminder && preference.last_sent_on !== local.date,
      localDate: local.date,
    };
  }
}

export async function POST(request: Request) {
  const expectedSecret = process.env.NOTIFICATION_CRON_SECRET;
  const suppliedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Notifications are not configured." }, { status: 503 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: preferences, error: preferenceError } = await admin
    .from("notification_preferences")
    .select("user_id, reminder_time, timezone, last_sent_on")
    .eq("enabled", true);

  if (preferenceError) {
    return NextResponse.json({ error: preferenceError.message }, { status: 500 });
  }

  const now = new Date();
  let sent = 0;
  let skippedCheckedIn = 0;
  let expired = 0;
  let failed = 0;

  for (const preference of (preferences ?? []) as Preference[]) {
    const { due, localDate } = isReminderDue(preference, now);
    if (!due) continue;

    const { data: existingCheckin } = await admin
      .from("daily_checkins")
      .select("id")
      .eq("user_id", preference.user_id)
      .eq("day", localDate)
      .maybeSingle();

    if (existingCheckin) {
      skippedCheckedIn += 1;
      await admin
        .from("notification_preferences")
        .update({ last_sent_on: localDate, updated_at: now.toISOString() })
        .eq("user_id", preference.user_id);
      continue;
    }

    const { data: subscriptions, error: subscriptionError } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint")
      .eq("user_id", preference.user_id);

    if (subscriptionError) {
      failed += 1;
      continue;
    }

    let deliveredForUser = false;
    for (const subscription of (subscriptions ?? []) as PushSubscriptionRow[]) {
      try {
        const status = await sendEmptyPush(subscription.endpoint);
        if (status === 201 || status === 202) {
          sent += 1;
          deliveredForUser = true;
        } else if (status === 404 || status === 410) {
          expired += 1;
          await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }

    if (deliveredForUser) {
      await admin
        .from("notification_preferences")
        .update({ last_sent_on: localDate, updated_at: now.toISOString() })
        .eq("user_id", preference.user_id);
    }
  }

  return NextResponse.json({ ok: true, sent, skippedCheckedIn, expired, failed });
}
