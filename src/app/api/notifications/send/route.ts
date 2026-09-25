import { enforceRateLimit, requestIp } from "@/lib/server/rateLimit";
import { createClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { reminderDelivery } from "@/lib/server/reminderDelivery";
import {
  fiveMinuteBucket,
  isLocalTimeDue,
  localClock,
  previousDateKey,
  routineOccursOnDay,
} from "@/lib/schedule";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHECKIN_REMINDER_TIMES = ["18:00", "21:00", "22:00", "23:00", "23:30"];
const SCHEDULE_CATCHUP_MINUTES = 15;

type PreferenceRow = Pick<
  Tables<"notification_preferences">,
  | "user_id"
  | "timezone"
  | "task_enabled"
  | "routine_enabled"
  | "health_enabled"
  | "workout_enabled"
  | "checkin_enabled"
>;

async function runInChunks<T>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<void>,
) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.allSettled(items.slice(index, index + size).map(worker));
  }
}

async function sendNotifications(request: Request) {
  const startedAt = Date.now();
  const expected =
    process.env.CRON_SECRET ?? process.env.NOTIFICATION_CRON_SECRET;
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

  const admin = createClient<Database>(url, key, {
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
  const eventBucket = fiveMinuteBucket(now);

  const { data: preferenceRows, error: preferenceError } = await admin
    .from("notification_preferences")
    .select(
      "user_id,timezone,task_enabled,routine_enabled,health_enabled,workout_enabled,checkin_enabled",
    )
    .eq("enabled", true);

  if (preferenceError) {
    return NextResponse.json(
      { error: "Reminders could not be loaded." },
      { status: 500 },
    );
  }

  const preferences: PreferenceRow[] = [];
  const clocks = new Map<string, ReturnType<typeof localClock>>();

  for (const preference of preferenceRows ?? []) {
    try {
      clocks.set(
        preference.user_id,
        localClock(now, preference.timezone),
      );
      preferences.push(preference);
    } catch {
      counts.failed++;
    }
  }

  const userIds = preferences.map((preference) => preference.user_id);
  const preferenceByUser = new Map(
    preferences.map((preference) => [preference.user_id, preference]),
  );
  let dueTasks = 0;
  let dueRoutines = 0;
  let dueCheckins = 0;
  let dueMissedCheckins = 0;
  let skippedCheckedIn = 0;

  if (userIds.length > 0) {
    const relevantDays = [
      ...new Set(
        preferences.flatMap((preference) => {
          const day = clocks.get(preference.user_id)?.day;
          return day ? [day, previousDateKey(day)] : [];
        }),
      ),
    ];

    const { data: checkins, error: checkinError } = await admin
      .from("daily_checkins")
      .select("id,user_id,day,completed_at")
      .in("user_id", userIds)
      .in("day", relevantDays);

    if (checkinError) {
      counts.failed++;
    }

    const finishedCheckins = new Set<string>();
    const checkinIdsByUserDay = new Map<string, string>();

    for (const checkin of checkins ?? []) {
      const key = `${checkin.user_id}:${checkin.day}`;
      checkinIdsByUserDay.set(key, checkin.id);
      if (checkin.completed_at) finishedCheckins.add(key);
    }

    const checkinIds = [...checkinIdsByUserDay.values()];
    const completedRoutineItems = new Set<string>();

    if (checkinIds.length > 0) {
      const { data: routineItems, error: routineItemError } = await admin
        .from("checkin_items")
        .select("checkin_id,item_id")
        .in("checkin_id", checkinIds)
        .eq("item_type", "routine")
        .eq("completed", true);

      if (routineItemError) {
        counts.failed++;
      } else {
        for (const item of routineItems ?? []) {
          completedRoutineItems.add(`${item.checkin_id}:${item.item_id}`);
        }
      }
    }

    await runInChunks(preferences, 25, async (preference) => {
      const clock = clocks.get(preference.user_id);
      if (!clock || !preference.checkin_enabled) return;

      const currentKey = `${preference.user_id}:${clock.day}`;
      const dueTimes = CHECKIN_REMINDER_TIMES.filter((time) =>
        isLocalTimeDue(clock.time, time, SCHEDULE_CATCHUP_MINUTES),
      );

      if (finishedCheckins.has(currentKey)) {
        skippedCheckedIn += dueTimes.length;
      } else {
        for (const time of dueTimes) {
          dueCheckins++;
          await deliver(
            preference.user_id,
            "checkin",
            "checkin",
            `checkin:${clock.day}:${time}`,
          );
        }
      }

      if (
        isLocalTimeDue(clock.time, "00:05", SCHEDULE_CATCHUP_MINUTES)
      ) {
        const missedDay = previousDateKey(clock.day);
        const missedKey = `${preference.user_id}:${missedDay}`;
        if (!finishedCheckins.has(missedKey)) {
          dueMissedCheckins++;
          await deliver(
            preference.user_id,
            "checkin",
            "checkin_missed",
            `checkin-missed:${missedDay}`,
          );
        }
      }
    });

    const { data: taskRows, error: taskError } = await admin
      .from("tasks")
      .select("id,user_id,title,due_at")
      .in("user_id", userIds)
      .eq("is_done", false)
      .not("due_at", "is", null)
      .lte("due_at", now.toISOString())
      .gte(
        "due_at",
        new Date(
          now.getTime() - SCHEDULE_CATCHUP_MINUTES * 60 * 1000,
        ).toISOString(),
      )
      .order("due_at", { ascending: false })
      .limit(500);

    if (taskError) {
      counts.failed++;
    } else {
      await runInChunks(taskRows ?? [], 25, async (task) => {
        if (
          !task.due_at ||
          !preferenceByUser.get(task.user_id)?.task_enabled
        ) {
          return;
        }

        dueTasks++;
        await deliver(
          task.user_id,
          "checkin",
          "task",
          `task:${task.id}`,
          task.title,
        );
      });
    }

    const { data: routineRows, error: routineError } = await admin
      .from("routines")
      .select("id,user_id,title,frequency,days_of_week,preferred_time")
      .in("user_id", userIds)
      .eq("is_active", true)
      .not("preferred_time", "is", null)
      .limit(1000);

    if (routineError) {
      counts.failed++;
    } else {
      await runInChunks(routineRows ?? [], 25, async (routine) => {
        const clock = clocks.get(routine.user_id);
        if (
          !clock ||
          !routine.preferred_time ||
          !preferenceByUser.get(routine.user_id)?.routine_enabled
        ) {
          return;
        }
        if (routine.frequency !== "daily" && routine.frequency !== "weekly")
          return;
        if (
          !routineOccursOnDay(
            routine.frequency,
            routine.days_of_week,
            clock.day,
          ) ||
          !isLocalTimeDue(
            clock.time,
            routine.preferred_time,
            SCHEDULE_CATCHUP_MINUTES,
          )
        ) {
          return;
        }

        const checkinId = checkinIdsByUserDay.get(
          `${routine.user_id}:${clock.day}`,
        );
        if (
          checkinId &&
          completedRoutineItems.has(`${checkinId}:${routine.id}`)
        ) {
          return;
        }

        dueRoutines++;
        await deliver(
          routine.user_id,
          "checkin",
          "routine",
          `routine:${routine.id}:${clock.day}`,
          routine.title,
        );
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
      .select(
        "id,user_id,name,notified_at,medication_plans!inner(is_active)",
      )
      .in("user_id", userIds)
      .is("taken_at", null)
      .eq("medication_plans.is_active", true)
      .lte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: false })
      .limit(500);

    if (healthError) {
      counts.failed++;
    } else {
      await runInChunks(healthRows ?? [], 25, async (reminder) => {
        if (!preferenceByUser.get(reminder.user_id)?.health_enabled) return;

        const accepted = await deliver(
          reminder.user_id,
          "health",
          "health",
          `health:${reminder.id}:${eventBucket}`,
          reminder.name,
        );

        if (accepted && !reminder.notified_at) {
          const { error: updateError } = await admin
            .from("medication_reminders")
            .update({ notified_at: now.toISOString() })
            .eq("id", reminder.id)
            .is("notified_at", null);
          if (updateError) counts.failed++;
        }
      });
    }

    const { error: workoutSyncError } = await admin.rpc(
      "sync_workout_sessions",
    );
    if (workoutSyncError) {
      return NextResponse.json(
        { error: "Scheduled sessions could not be prepared." },
        { status: 500 },
      );
    }

    const { data: workoutRows, error: workoutError } = await admin
      .from("workout_sessions")
      .select("id,user_id,name,workout_plans!inner(is_active)")
      .in("user_id", userIds)
      .is("completed_at", null)
      .is("notified_at", null)
      .eq("workout_plans.is_active", true)
      .lte("scheduled_at", now.toISOString())
      .gte(
        "scheduled_at",
        new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      )
      .order("scheduled_at")
      .limit(500);

    if (workoutError) {
      counts.failed++;
    } else {
      await runInChunks(workoutRows ?? [], 25, async (session) => {
        if (!preferenceByUser.get(session.user_id)?.workout_enabled) return;

        if (
          await deliver(
            session.user_id,
            "workout",
            "workout",
            `workout:${session.id}`,
            session.name,
          )
        ) {
          const { error: updateError } = await admin
            .from("workout_sessions")
            .update({ notified_at: now.toISOString() })
            .eq("id", session.id)
            .is("notified_at", null);
          if (updateError) counts.failed++;
        }
      });
    }

    const result = {
      ok: counts.failed === 0,
      ...counts,
      skippedCheckedIn,
      dueTasks,
      dueRoutines,
      dueCheckins,
      dueMissedCheckins,
      dueMedication: healthRows?.length ?? 0,
      dueWorkouts: workoutRows?.length ?? 0,
      durationMs: Date.now() - startedAt,
    };

    await admin
      .from("push_deliveries")
      .delete()
      .lt(
        "attempted_at",
        new Date(now.getTime() - 30 * 86400000).toISOString(),
      );

    const log = JSON.stringify({ kind: "notification_cron", ...result });
    if (result.ok) console.info(log);
    else console.error(log);

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  const result = {
    ok: counts.failed === 0,
    ...counts,
    skippedCheckedIn,
    dueTasks,
    dueRoutines,
    dueCheckins,
    dueMissedCheckins,
    dueMedication: 0,
    dueWorkouts: 0,
    durationMs: Date.now() - startedAt,
  };

  const log = JSON.stringify({ kind: "notification_cron", ...result });
  if (result.ok) console.info(log);
  else console.error(log);

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(request: Request) {
  return sendNotifications(request);
}

export async function POST(request: Request) {
  return sendNotifications(request);
}
