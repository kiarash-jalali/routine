import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { supabaseServer } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

export const runtime = "nodejs";

const MAX_MUTATIONS = 100;
const MAX_ITEMS_PER_CHECKIN = 200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type ItemType = "routine" | "task";

type DailyItemMutation = {
  id: string;
  kind: "daily_item_completion";
  userId: string;
  queuedAt: string;
  day: string;
  itemType: ItemType;
  itemId: string;
  completed: boolean;
};

type FinishCheckinMutation = {
  id: string;
  kind: "finish_daily_checkin";
  userId: string;
  queuedAt: string;
  day: string;
  items: Array<{
    item_type: ItemType;
    item_id: string;
    completed: boolean;
  }>;
};

type OfflineMutation = DailyItemMutation | FinishCheckinMutation;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isQueuedAt(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 40 &&
    !Number.isNaN(Date.parse(value))
  );
}

function isItemType(value: unknown): value is ItemType {
  return value === "routine" || value === "task";
}

function parseMutation(value: unknown): OfflineMutation | null {
  if (!isRecord(value)) return null;
  const { id, kind, userId, queuedAt, day } = value;

  if (
    typeof id !== "string" ||
    id.length < 1 ||
    id.length > 320 ||
    !isUuid(userId) ||
    !isQueuedAt(queuedAt) ||
    !isDateKey(day)
  ) {
    return null;
  }

  if (kind === "daily_item_completion") {
    if (
      !isItemType(value.itemType) ||
      !isUuid(value.itemId) ||
      typeof value.completed !== "boolean"
    ) {
      return null;
    }

    return {
      id,
      kind,
      userId,
      queuedAt,
      day,
      itemType: value.itemType,
      itemId: value.itemId,
      completed: value.completed,
    };
  }

  if (kind !== "finish_daily_checkin" || !Array.isArray(value.items)) {
    return null;
  }

  if (value.items.length > MAX_ITEMS_PER_CHECKIN) return null;

  const items: FinishCheckinMutation["items"] = [];
  for (const item of value.items) {
    if (
      !isRecord(item) ||
      !isItemType(item.item_type) ||
      !isUuid(item.item_id) ||
      typeof item.completed !== "boolean"
    ) {
      return null;
    }
    items.push({
      item_type: item.item_type,
      item_id: item.item_id,
      completed: item.completed,
    });
  }

  return { id, kind, userId, queuedAt, day, items };
}

function canDiscardRpcError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  return [
    "daily_item_not_found",
    "invalid_daily_item",
    "invalid_daily_item_type",
    "invalid_checkin_day",
  ].some((code) => message.includes(code));
}

export async function POST(request: Request) {
  const requestOrigin = request.headers.get("origin");
  const expectedOrigin = new URL(request.url).origin;
  if (requestOrigin && requestOrigin !== expectedOrigin) {
    return NextResponse.json({ error: "Cross-origin sync is not allowed." }, { status: 403 });
  }

  const db = await supabaseServer();
  const { data: claimsData, error: claimsError } = await db.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (claimsError || !userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Offline sync is temporarily unavailable." }, { status: 503 });
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const allowed = await enforceRateLimit(
      admin,
      "offline-sync",
      userId,
      20,
      60,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many sync attempts. Try again shortly." },
        { status: 429 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Offline sync is temporarily unavailable." }, { status: 503 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid sync payload." }, { status: 400 });
  }

  if (!isRecord(rawBody) || !Array.isArray(rawBody.mutations)) {
    return NextResponse.json({ error: "Invalid sync payload." }, { status: 400 });
  }
  if (rawBody.mutations.length > MAX_MUTATIONS) {
    return NextResponse.json({ error: "Too many queued changes." }, { status: 413 });
  }

  const mutations: OfflineMutation[] = [];
  for (const value of rawBody.mutations) {
    const mutation = parseMutation(value);
    if (!mutation) {
      return NextResponse.json({ error: "Invalid queued change." }, { status: 400 });
    }
    if (mutation.userId !== userId) {
      return NextResponse.json({ error: "Queued change belongs to another account." }, { status: 403 });
    }
    mutations.push(mutation);
  }

  mutations.sort((left, right) => left.queuedAt.localeCompare(right.queuedAt));

  const appliedIds: string[] = [];
  const discardedIds: string[] = [];
  const retryIds: string[] = [];

  for (const mutation of mutations) {
    try {
      if (mutation.kind === "daily_item_completion") {
        const { error } = await db.rpc("set_daily_item_completion", {
          p_day: mutation.day,
          p_item_type: mutation.itemType,
          p_item_id: mutation.itemId,
          p_completed: mutation.completed,
        });

        if (error) {
          (canDiscardRpcError(error) ? discardedIds : retryIds).push(mutation.id);
        } else {
          appliedIds.push(mutation.id);
        }
        continue;
      }

      const taskIds = [
        ...new Set(
          mutation.items
            .filter((item) => item.item_type === "task")
            .map((item) => item.item_id),
        ),
      ];
      const routineIds = [
        ...new Set(
          mutation.items
            .filter((item) => item.item_type === "routine")
            .map((item) => item.item_id),
        ),
      ];

      const taskResult = taskIds.length
        ? await db.from("tasks").select("id").in("id", taskIds)
        : { data: [] as Array<{ id: string }>, error: null };
      const routineResult = routineIds.length
        ? await db.from("routines").select("id").in("id", routineIds)
        : { data: [] as Array<{ id: string }>, error: null };

      if (taskResult.error || routineResult.error) {
        retryIds.push(mutation.id);
        continue;
      }

      const ownedTaskIds = new Set((taskResult.data ?? []).map((row) => row.id));
      const ownedRoutineIds = new Set(
        (routineResult.data ?? []).map((row) => row.id),
      );
      const validItems = mutation.items.filter((item) =>
        item.item_type === "task"
          ? ownedTaskIds.has(item.item_id)
          : ownedRoutineIds.has(item.item_id),
      );

      const { error } = await db.rpc("finish_daily_checkin", {
        p_day: mutation.day,
        p_items: validItems as Json,
      });

      if (error) {
        (canDiscardRpcError(error) ? discardedIds : retryIds).push(mutation.id);
      } else {
        appliedIds.push(mutation.id);
      }
    } catch {
      retryIds.push(mutation.id);
    }
  }

  return NextResponse.json({
    ok: retryIds.length === 0,
    appliedIds,
    discardedIds,
    retryIds,
  });
}
