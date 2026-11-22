import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type {
  BodyProfileInput,
  MeasurementInput,
  WeighInState,
} from "@/types/body";

// Body values are health data: never log them, put them in error messages,
// push payloads or snapshots. Errors carry codes only.
const profileColumns =
  "user_id,sex,birth_year,height_cm,activity_level,goal_mode,goal_weight_kg,goal_rate_kg_week,kcal_target_override,protein_mode,protein_grams,week_starts_on";
const measurementColumns =
  "id,measured_on,weight_kg,waist_cm,body_fat_pct,note";

export const BODY_HISTORY_DAYS = 365;

function daysBefore(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function loadBody(
  userId: string,
  today: string,
  client?: SupabaseClient<Database>,
) {
  const db = client ?? supabaseBrowser();
  const [profile, measurements] = await Promise.all([
    db
      .from("body_profiles")
      .select(profileColumns)
      .eq("user_id", userId)
      .maybeSingle(),
    db
      .from("body_measurements")
      .select(measurementColumns)
      .eq("user_id", userId)
      .gte("measured_on", daysBefore(today, BODY_HISTORY_DAYS))
      .order("measured_on", { ascending: false })
      .limit(BODY_HISTORY_DAYS + 1),
  ]);
  if (profile.error || measurements.error) throw new Error("body_load_failed");
  return {
    profile: profile.data ?? null,
    measurements: measurements.data ?? [],
  };
}

export async function getWeighInState(
  userId: string,
  day: string,
  client?: SupabaseClient<Database>,
): Promise<WeighInState> {
  const db = client ?? supabaseBrowser();
  const [profile, measurement] = await Promise.all([
    db
      .from("body_profiles")
      .select("week_starts_on")
      .eq("user_id", userId)
      .maybeSingle(),
    db
      .from("body_measurements")
      .select("id,weight_kg,waist_cm")
      .eq("user_id", userId)
      .eq("measured_on", day)
      .maybeSingle(),
  ]);
  if (profile.error || measurement.error) throw new Error("body_today_load_failed");
  return {
    hasProfile: Boolean(profile.data),
    weekStartsOn: profile.data?.week_starts_on ?? 6,
    today: measurement.data ?? null,
  };
}

export async function saveBodyProfile(userId: string, values: BodyProfileInput) {
  const { error } = await supabaseBrowser()
    .from("body_profiles")
    .upsert({ ...values, user_id: userId }, { onConflict: "user_id" });
  if (error) throw new Error("body_profile_save_failed");
}

/**
 * One row per day: saving the same day again updates it. Only the fields
 * given are written, so a weight-only save keeps that day's waist.
 */
export async function saveMeasurement(userId: string, values: MeasurementInput) {
  const row: Database["public"]["Tables"]["body_measurements"]["Insert"] = {
    user_id: userId,
    measured_on: values.measured_on,
  };
  if (values.weight_kg !== undefined) row.weight_kg = values.weight_kg;
  if (values.waist_cm !== undefined) row.waist_cm = values.waist_cm;
  if (values.body_fat_pct !== undefined) row.body_fat_pct = values.body_fat_pct;
  if (values.note !== undefined) row.note = values.note;
  const { error } = await supabaseBrowser()
    .from("body_measurements")
    .upsert(row, { onConflict: "user_id,measured_on" });
  if (error) throw new Error("body_measurement_save_failed");
}

/** Moves an edited entry to another day: the old day's row is replaced. */
export async function replaceMeasurement(
  userId: string,
  id: string,
  values: Required<MeasurementInput>,
) {
  const { error } = await supabaseBrowser()
    .from("body_measurements")
    .update(values)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    throw new Error(
      error.code === "23505" ? "body_measurement_day_taken" : "body_measurement_save_failed",
    );
  }
}

export async function deleteMeasurement(userId: string, id: string) {
  const { error } = await supabaseBrowser()
    .from("body_measurements")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error("body_measurement_delete_failed");
}
