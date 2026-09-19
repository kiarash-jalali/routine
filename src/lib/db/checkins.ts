import { supabaseBrowser } from "@/lib/supabaseClient";
import type {
  CheckinItem,
  CheckinItemUpsert,
  DailyCheckinSummary,
} from "@/types/checkin";

const DAILY_CHECKIN_COLUMNS = "id,user_id,day,submitted_at";

export async function findDailyCheckin(
  userId: string,
  day: string,
): Promise<DailyCheckinSummary | null> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("daily_checkins")
    .select(DAILY_CHECKIN_COLUMNS)
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();

  if (error) throw error;
  return data as DailyCheckinSummary | null;
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

  // Another browser tab may have created today's row after our first query.
  if (error?.code === "23505") {
    const concurrentlyCreatedCheckin = await findDailyCheckin(userId, day);
    if (concurrentlyCreatedCheckin) return concurrentlyCreatedCheckin;
  }

  if (error) throw error;
  if (!data) throw new Error("The daily check-in could not be created.");

  return data as DailyCheckinSummary;
}

export async function listCheckinItems(
  checkinId: string,
): Promise<CheckinItem[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("checkin_items")
    .select("item_type,item_id,completed")
    .eq("checkin_id", checkinId);

  if (error) throw error;
  return (data ?? []) as CheckinItem[];
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


export async function submitDailyCheckin(
  checkinId: string,
): Promise<DailyCheckinSummary> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("daily_checkins")
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", checkinId)
    .is("submitted_at", null)
    .select(DAILY_CHECKIN_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as DailyCheckinSummary;

  const { data: existing, error: existingError } = await supabase
    .from("daily_checkins")
    .select(DAILY_CHECKIN_COLUMNS)
    .eq("id", checkinId)
    .single();

  if (existingError) throw existingError;
  return existing as DailyCheckinSummary;
}

export async function listDailyCompletionItems(
  userId: string,
  day: string,
): Promise<CheckinItem[]> {
  const checkin = await findDailyCheckin(userId, day);
  return checkin ? listCheckinItems(checkin.id) : [];
}

export async function saveDailyItemCompletion(
  userId: string,
  day: string,
  itemType: "task" | "routine",
  itemId: string,
  completed: boolean,
): Promise<void> {
  const checkin = await getOrCreateDailyCheckin(userId, day);
  await saveCheckinItems([
    {
      user_id: userId,
      checkin_id: checkin.id,
      item_type: itemType,
      item_id: itemId,
      completed,
    },
  ]);
}
