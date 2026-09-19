import { enforceRateLimit } from "@/lib/server/rateLimit";
import type { Database, Tables } from "@/types/database";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PAGE_SIZE = 500;

type QueryPage<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

async function collectAll<T>(
  fetchPage: (from: number, to: number) => Promise<QueryPage<T>>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error("account_export_query_failed");

    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Account export is temporarily unavailable." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!accessToken) return unauthorized("Not authenticated.");

  const userDb = createClient<Database>(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await userDb.auth.getUser(accessToken);

  if (userError || !user) {
    return unauthorized("Your session is no longer valid.");
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const allowed = await enforceRateLimit(
      admin,
      "account-export",
      user.id,
      5,
      15 * 60,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many export requests. Try again later." },
        { status: 429 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Account export is temporarily unavailable." },
      { status: 503 },
    );
  }

  try {
    const [
      profiles,
      routines,
      tasks,
      dailyCheckins,
      checkinItems,
      pointTransactions,
      streakRepairs,
      notificationPreferences,
      medicationPlans,
      medicationReminders,
      workoutPlans,
      workoutSessions,
      feedback,
    ] = await Promise.all([
      collectAll<Tables<"profiles">>(async (from, to) => {
        const { data, error } = await userDb
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"routines">>(async (from, to) => {
        const { data, error } = await userDb
          .from("routines")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"tasks">>(async (from, to) => {
        const { data, error } = await userDb
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"daily_checkins">>(async (from, to) => {
        const { data, error } = await userDb
          .from("daily_checkins")
          .select("*")
          .eq("user_id", user.id)
          .order("day", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"checkin_items">>(async (from, to) => {
        const { data, error } = await userDb
          .from("checkin_items")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"point_transactions">>(async (from, to) => {
        const { data, error } = await userDb
          .from("point_transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"streak_repairs">>(async (from, to) => {
        const { data, error } = await userDb
          .from("streak_repairs")
          .select("*")
          .eq("user_id", user.id)
          .order("day", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"notification_preferences">>(async (from, to) => {
        const { data, error } = await userDb
          .from("notification_preferences")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"medication_plans">>(async (from, to) => {
        const { data, error } = await userDb
          .from("medication_plans")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"medication_reminders">>(async (from, to) => {
        const { data, error } = await userDb
          .from("medication_reminders")
          .select("*")
          .eq("user_id", user.id)
          .order("scheduled_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"workout_plans">>(async (from, to) => {
        const { data, error } = await userDb
          .from("workout_plans")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"workout_sessions">>(async (from, to) => {
        const { data, error } = await userDb
          .from("workout_sessions")
          .select("*")
          .eq("user_id", user.id)
          .order("scheduled_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"feedback">>(async (from, to) => {
        const { data, error } = await userDb
          .from("feedback")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
    ]);

    const exportedAt = new Date().toISOString();
    const body = JSON.stringify(
      {
        format: "rootine-account-export",
        version: 1,
        exported_at: exportedAt,
        account: {
          id: user.id,
          email: user.email ?? null,
          created_at: user.created_at,
        },
        data: {
          profiles,
          routines,
          tasks,
          daily_checkins: dailyCheckins,
          checkin_items: checkinItems,
          point_transactions: pointTransactions,
          streak_repairs: streakRepairs,
          notification_preferences: notificationPreferences,
          medication_plans: medicationPlans,
          medication_reminders: medicationReminders,
          workout_plans: workoutPlans,
          workout_sessions: workoutSessions,
          feedback,
        },
      },
      null,
      2,
    );

    const date = exportedAt.slice(0, 10);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="rootine-export-${date}.json"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Your data could not be exported. Try again in a moment." },
      {
        status: 500,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }
}
