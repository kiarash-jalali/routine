import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseBrowser } from "@/lib/supabaseClient";
import {
  isCheckinItemType,
  type DailyCheckinSummary,
} from "@/types/checkin";
import type {
  CheckinHistoryEntry,
  HistoricalCheckinItem,
} from "@/types/history";

const CHECKIN_COLUMNS = "id,user_id,day,completed_at";

export async function listCheckinDays(
  userId: string,
  client?: SupabaseClient<Database>,
): Promise<string[]> {
  const supabase = client ?? supabaseBrowser();
  const pageSize = 500;
  const days: string[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("daily_checkins")
      .select("day")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("day", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const rows = data ?? [];
    days.push(...rows.map((row) => row.day));

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return days;
}

export async function listRecentCheckinHistory(
  userId: string,
  limit = 30,
  client?: SupabaseClient<Database>,
): Promise<CheckinHistoryEntry[]> {
  const supabase = client ?? supabaseBrowser();
  const { data: checkins, error: checkinsError } = await supabase
    .from("daily_checkins")
    .select(CHECKIN_COLUMNS)
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("day", { ascending: false })
    .limit(limit);

  if (checkinsError) throw checkinsError;

  const checkinRows: DailyCheckinSummary[] = checkins ?? [];
  if (checkinRows.length === 0) return [];

  const checkinIds = checkinRows.map((checkin) => checkin.id);
  const { data: items, error: itemsError } = await supabase
    .from("checkin_items")
    .select("checkin_id,item_type,item_id,completed")
    .in("checkin_id", checkinIds);

  if (itemsError) throw itemsError;

  const itemsByCheckin = new Map<string, HistoricalCheckinItem[]>();
  for (const item of items ?? []) {
    if (!isCheckinItemType(item.item_type)) {
      throw new Error("invalid_checkin_item_type");
    }
    const historicalItem: HistoricalCheckinItem = {
      ...item,
      item_type: item.item_type,
    };
    const currentItems = itemsByCheckin.get(item.checkin_id) ?? [];
    currentItems.push(historicalItem);
    itemsByCheckin.set(item.checkin_id, currentItems);
  }

  return checkinRows.map((checkin) => ({
    id: checkin.id,
    user_id: checkin.user_id,
    day: checkin.day,
    completed_at: checkin.completed_at,
    items: itemsByCheckin.get(checkin.id) ?? [],
  }));
}
