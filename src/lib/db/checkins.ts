import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseBrowser } from "@/lib/supabaseClient";
import {
  isCheckinItemType,
  type CheckinItem,
  type CheckinItemType,
  type CheckinItemUpsert,
  type DailyCheckinSummary,
} from "@/types/checkin";

const DAILY_CHECKIN_COLUMNS = "id,user_id,day,completed_at";

export async function findDailyCheckin(
  userId: string,
  day: string,
  client?: SupabaseClient<Database>,
): Promise<DailyCheckinSummary | null> {
  const supabase = client ?? supabaseBrowser();
  const { data, error } = await supabase
    .from("daily_checkins")
    .select(DAILY_CHECKIN_COLUMNS)
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getOrCreateDailyCheckin(
  userId: string,
  day: string,
): Promise<DailyCheckinSummary> {
  const existingCheckin = await findDailyCheckin(userId, day);
  if (existingCheckin) return existingCheckin;

  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("daily_checkins")
    .insert({ user_id: userId, day })
    .select(DAILY_CHECKIN_COLUMNS)
    .single();

  if (error?.code === "23505") {
    const concurrentlyCreatedCheckin = await findDailyCheckin(userId, day);
    if (concurrentlyCreatedCheckin) return concurrentlyCreatedCheckin;
  }

  if (error) throw error;
  if (!data) throw new Error("The daily check-in could not be created.");

  return data;
}

export async function listCheckinItems(
  checkinId: string,
  client?: SupabaseClient<Database>,
): Promise<CheckinItem[]> {
  const supabase = client ?? supabaseBrowser();
  const { data, error } = await supabase
    .from("checkin_items")
    .select("item_type,item_id,completed")
    .eq("checkin_id", checkinId);

  if (error) throw error;
  return (data ?? []).map((item) => {
    if (!isCheckinItemType(item.item_type)) {
      throw new Error("invalid_checkin_item_type");
    }
    return { ...item, item_type: item.item_type };
  });
}

export async function getDailyProgress(
  userId: string,
  day: string,
  client?: SupabaseClient<Database>,
) {
  const checkin = await findDailyCheckin(userId, day, client);
  if (!checkin) return { checkin: null, items: [] };

  return {
    checkin,
    items: await listCheckinItems(checkin.id, client),
  };
}

export async function setDailyItemCompletion(
  day: string,
  itemType: CheckinItemType,
  itemId: string,
  completed: boolean,
): Promise<DailyCheckinSummary> {
  const { data, error } = await supabaseBrowser()
    .rpc("set_daily_item_completion", {
      p_day: day,
      p_item_type: itemType,
      p_item_id: itemId,
      p_completed: completed,
    })
    .single();

  if (error) throw error;
  if (!data) throw new Error("daily_item_update_failed");
  return data;
}

export async function finishDailyCheckin(
  day: string,
  items: CheckinItem[],
): Promise<DailyCheckinSummary> {
  const { data, error } = await supabaseBrowser()
    .rpc("finish_daily_checkin", {
      p_day: day,
      p_items: items,
    })
    .single();

  if (error) throw error;
  if (!data) throw new Error("checkin_finish_failed");
  return data;
}

export async function saveCheckinItems(
  items: CheckinItemUpsert[],
): Promise<void> {
  if (items.length === 0) return;

  const supabase = supabaseBrowser();
  const { error } = await supabase
    .from("checkin_items")
    .upsert(items, { onConflict: "checkin_id,item_type,item_id" });

  if (error) throw error;
}
