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
import { defaultWeekStart } from "@/lib/nutrition/body";
import { addDays, startOfWeek, weekdayOf } from "@/lib/nutrition/plan";

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
  | "meal_plan_enabled"
  | "meal_plan_dow"
  | "meal_plan_time"
  | "grocery_enabled"
  | "grocery_dow"
  | "grocery_time"
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
      "user_id,timezone,task_enabled,routine_enabled,health_enabled,workout_enabled,checkin_enabled,meal_plan_enabled,meal_plan_dow,meal_plan_time,grocery_enabled,grocery_dow,grocery_time",
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
  let dueMealPlans = 0;
  let dueGroceries = 0;

  if (userIds.length > 0) {
    const currentDays = [
      ...new Set(
        preferences
          .map((preference) => clocks.get(preference.user_id)?.day)
          .filter((day): day is string => Boolean(day)),
      ),
    ];
    const relevantDays = [
      ...new Set(
        currentDays.flatMap((day) => [day, previousDateKey(day)]),
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
      .eq("due_has_time", true)
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
        "id,user_id,scheduled_day,notified_at,medication_plans!inner(is_active)",
      )
      .in("user_id", userIds)
      .is("taken_at", null)
      .eq("medication_plans.is_active", true)
      .in("scheduled_day", currentDays)
      .lte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: false })
      .limit(500);

    if (healthError) {
      counts.failed++;
    } else {
      await runInChunks(healthRows ?? [], 25, async (reminder) => {
        const clock = clocks.get(reminder.user_id);
        if (
          !clock ||
          reminder.scheduled_day !== clock.day ||
          !preferenceByUser.get(reminder.user_id)?.health_enabled
        ) {
          return;
        }

        const accepted = await deliver(
          reminder.user_id,
          "health",
          "health",
          `health:${reminder.id}:${eventBucket}`,
          // Health data never goes into push payloads (CLAUDE.md rule 4).
          null,
          `health:${reminder.id}`,
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

    // Weekly meal-plan and grocery reminders (S4). Generic copy only: the sender
    // reads plan dates to know whether next week is planned, never names.
    const weeklyDue = (enabled: boolean, dow: number | null, time: string | null, userId: string) => {
      const clock = clocks.get(userId);
      return Boolean(
        enabled &&
          clock &&
          dow !== null &&
          time &&
          weekdayOf(clock.day) === dow &&
          isLocalTimeDue(clock.time, time.slice(0, 5), SCHEDULE_CATCHUP_MINUTES),
      );
    };
    const mealPlanUsers = preferences.filter((preference) =>
      weeklyDue(preference.meal_plan_enabled, preference.meal_plan_dow, preference.meal_plan_time, preference.user_id),
    );
    const groceryUsers = preferences.filter((preference) =>
      weeklyDue(preference.grocery_enabled, preference.grocery_dow, preference.grocery_time, preference.user_id),
    );
    const weeklyUserIds = [
      ...new Set([...mealPlanUsers, ...groceryUsers].map((preference) => preference.user_id)),
    ];

    if (weeklyUserIds.length > 0) {
      const [weekStarts, locales] = await Promise.all([
        admin.from("body_profiles").select("user_id,week_starts_on").in("user_id", weeklyUserIds),
        admin.from("profiles").select("user_id,locale").in("user_id", weeklyUserIds),
      ]);
      if (weekStarts.error || locales.error) counts.failed++;
      const weekStartByUser = new Map(
        (weekStarts.data ?? []).map((row) => [row.user_id, row.week_starts_on]),
      );
      const localeByUser = new Map((locales.data ?? []).map((row) => [row.user_id, row.locale]));
      const nextWeekStart = (userId: string) => {
        const clock = clocks.get(userId);
        const startsOn =
          weekStartByUser.get(userId) ?? defaultWeekStart(localeByUser.get(userId) ?? "en");
        return clock ? addDays(startOfWeek(clock.day, startsOn), 7) : null;
      };

      const plannedUsers = new Set<string>();
      if (groceryUsers.length > 0) {
        const starts = groceryUsers
          .map((preference) => nextWeekStart(preference.user_id))
          .filter((day): day is string => Boolean(day))
          .sort();
        if (starts.length > 0) {
          const { data: planRows, error: planError } = await admin
            .from("meal_plan_entries")
            .select("user_id,plan_date")
            .in("user_id", groceryUsers.map((preference) => preference.user_id))
            .gte("plan_date", starts[0]!)
            .lte("plan_date", addDays(starts[starts.length - 1]!, 6))
            .limit(5000);
          if (planError) counts.failed++;
          for (const row of planRows ?? []) {
            const start = nextWeekStart(row.user_id);
            if (start && row.plan_date >= start && row.plan_date <= addDays(start, 6)) {
              plannedUsers.add(row.user_id);
            }
          }
        }
      }

      const mealPlanDue = new Set(mealPlanUsers.map((preference) => preference.user_id));
      await runInChunks(mealPlanUsers, 25, async (preference) => {
        const week = nextWeekStart(preference.user_id);
        if (!week) return;
        dueMealPlans++;
        await deliver(preference.user_id, "meal_plan", "meal_plan", `meal-plan:${week}`);
      });
      await runInChunks(groceryUsers, 25, async (preference) => {
        const week = nextWeekStart(preference.user_id);
        if (!week) return;
        const planned = plannedUsers.has(preference.user_id);
        // One "plan" nudge is enough when both reminders fall due together.
        if (!planned && mealPlanDue.has(preference.user_id)) return;
        dueGroceries++;
        // Nothing planned for next week yet: nudge to plan instead.
        await deliver(
          preference.user_id,
          "grocery",
          planned ? "grocery" : "meal_plan",
          `grocery:${week}`,
        );
      });
    }

    const result = {
      ok: counts.failed === 0,
      ...counts,
      skippedCheckedIn,
      dueMealPlans,
      dueGroceries,
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
    dueMealPlans,
    dueGroceries,
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
