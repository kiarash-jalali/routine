import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { MedicationInput } from "@/types/health";
const planColumns =
  "id,user_id,name,dose,notes,times,days_of_week,timezone,is_active,reminders_enabled,start_date,end_date,created_at,updated_at";
const reminderColumns =
  "id,user_id,medication_id,scheduled_day,scheduled_time,scheduled_at,timezone,name,dose,taken_at";
export async function loadHealth(
  userId: string,
  historyLimit = 100,
  client?: SupabaseClient<Database>,
) {
  const db = client ?? supabaseBrowser();
  const [plans, reminders] = await Promise.all([
    db
      .from("medication_plans")
      .select(planColumns)
      .eq("user_id", userId)
      .order("created_at"),
    db
      .from("medication_reminders")
      .select(reminderColumns)
      .eq("user_id", userId)
      .order("scheduled_at", { ascending: false })
      .limit(historyLimit),
  ]);
  if (plans.error || reminders.error) throw new Error("health_load_failed");
  return {
    plans: plans.data ?? [],
    reminders: reminders.data ?? [],
  };
}
export async function listMedicationRemindersForDay(
  userId: string,
  day: string,
  client?: SupabaseClient<Database>,
) {
  const { data, error } = await (client ?? supabaseBrowser())
    .from("medication_reminders")
    .select(reminderColumns)
    .eq("user_id", userId)
    .eq("scheduled_day", day)
    .order("scheduled_at");

  if (error) throw new Error("health_today_load_failed");
  return data ?? [];
}

export async function saveMedication(
  userId: string,
  values: MedicationInput,
  id?: string,
) {
  const db = supabaseBrowser();
  const query = id
    ? db
        .from("medication_plans")
        .update(values)
        .eq("id", id)
        .eq("user_id", userId)
    : db.from("medication_plans").insert({ ...values, user_id: userId });
  const { error } = await query;
  if (error) throw new Error("medication_save_failed");

  const { error: syncError } = await db.rpc("sync_medication_reminders", {
    target_user_id: userId,
  });
  if (syncError) throw new Error("health_sync_failed");
}
export async function setMedicationActive(
  userId: string,
  id: string,
  isActive: boolean,
) {
  const db = supabaseBrowser();
  const { error } = await db
    .from("medication_plans")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error("medication_update_failed");

  const { error: syncError } = await db.rpc("sync_medication_reminders", {
    target_user_id: userId,
  });
  if (syncError) throw new Error("health_sync_failed");
}
export async function setMedicationTaken(
  userId: string,
  id: string,
  taken: boolean,
) {
  const { error } = await supabaseBrowser()
    .from("medication_reminders")
    .update({ taken_at: taken ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error("medication_completion_failed");
}
