import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Routine } from "@/types/routine";

// Returns ACTIVE routines that apply to "today" (based on frequency + weekday)
export async function listTodaysRoutines() {
  const supabase = supabaseBrowser();

  // Get all active routines for the user (RLS filters by user_id)
  const { data, error } = await supabase
    .from("routines")
    .select("*")
    .eq("is_active", true)
    .order("preferred_time", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) return { data: null, error };

  const routines = (data ?? []) as Routine[];

  // JS: getDay() => Sun=0..Sat=6
  // We use our convention Mon=1..Sun=7
  const jsDay = new Date().getDay(); // 0..6
  const today = jsDay === 0 ? 7 : jsDay; // 1..7

  const todays = routines.filter((r) => {
    if (r.frequency === "daily") return true;
    if (r.frequency === "weekly") {
      const days = r.days_of_week ?? [];
      return days.includes(today);
    }
    return false;
  });

  return { data: todays, error: null };
}
