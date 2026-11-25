import { authenticatePrivilegedRequest } from "@/lib/server/requestAuth";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import type { Tables } from "@/types/database";
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
  const auth = await authenticatePrivilegedRequest(request);

  if (!auth.ok) {
    if (auth.error === "server_unavailable") {
      return NextResponse.json(
        { error: "export_unavailable" },
        { status: 503 },
      );
    }
    return unauthorized(
      auth.error === "not_authenticated"
        ? "not_authenticated"
        : "session_invalid",
    );
  }

  const { admin, user, userDb } = auth;

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
        { error: "export_rate_limited" },
        { status: 429 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "export_unavailable" },
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
      foods,
      recipes,
      recipeIngredients,
      workoutPlanExercises,
      workoutSetLogs,
      bodyProfiles,
      bodyMeasurements,
      targetAdjustments,
      foodLogEntries,
      mealPlanEntries,
      groceryLists,
      groceryListItems,
      reminderAdaptations,
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
      collectAll<Tables<"foods">>(async (from, to) => {
        const { data, error } = await userDb
          .from("foods")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"recipes">>(async (from, to) => {
        const { data, error } = await userDb
          .from("recipes")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"recipe_ingredients">>(async (from, to) => {
        const { data, error } = await userDb
          .from("recipe_ingredients")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"workout_plan_exercises">>(async (from, to) => {
        const { data, error } = await userDb
          .from("workout_plan_exercises")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"workout_set_logs">>(async (from, to) => {
        const { data, error } = await userDb
          .from("workout_set_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"body_profiles">>(async (from, to) => {
        const { data, error } = await userDb
          .from("body_profiles")
          .select("*")
          .eq("user_id", user.id)
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"body_measurements">>(async (from, to) => {
        const { data, error } = await userDb
          .from("body_measurements")
          .select("*")
          .eq("user_id", user.id)
          .order("measured_on", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"target_adjustments">>(async (from, to) => {
        const { data, error } = await userDb
          .from("target_adjustments")
          .select("*")
          .eq("user_id", user.id)
          .order("effective_from", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"food_log_entries">>(async (from, to) => {
        const { data, error } = await userDb
          .from("food_log_entries")
          .select("*")
          .eq("user_id", user.id)
          .order("eaten_on", { ascending: true })
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"meal_plan_entries">>(async (from, to) => {
        const { data, error } = await userDb
          .from("meal_plan_entries")
          .select("*")
          .eq("user_id", user.id)
          .order("plan_date", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"grocery_lists">>(async (from, to) => {
        const { data, error } = await userDb
          .from("grocery_lists")
          .select("*")
          .eq("user_id", user.id)
          .order("week_start", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"grocery_list_items">>(async (from, to) => {
        const { data, error } = await userDb
          .from("grocery_list_items")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      collectAll<Tables<"reminder_adaptations">>(async (from, to) => {
        const { data, error } = await userDb
          .from("reminder_adaptations")
          .select("*")
          .eq("user_id", user.id)
          .order("category", { ascending: true })
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
          foods,
          recipes,
          recipe_ingredients: recipeIngredients,
          workout_plan_exercises: workoutPlanExercises,
          workout_set_logs: workoutSetLogs,
          body_profiles: bodyProfiles,
          body_measurements: bodyMeasurements,
          target_adjustments: targetAdjustments,
          food_log_entries: foodLogEntries,
          meal_plan_entries: mealPlanEntries,
          grocery_lists: groceryLists,
          grocery_list_items: groceryListItems,
          reminder_adaptations: reminderAdaptations,
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
      { error: "export_failed" },
      {
        status: 500,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }
}
