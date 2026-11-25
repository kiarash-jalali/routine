import { cookies } from "next/headers";
import { pageMetadata } from "@/lib/server/pageMetadata";
import { getServerLocalDay } from "@/lib/server/localDay";
import { loadFoodHub, type FoodHubData } from "@/lib/db/food";
import { loadFoodDay, type FoodDay } from "@/lib/db/foodLog";
import {
  getWeekStartsOn,
  loadPlanEntries,
  loadPlanTargets,
  type PlanEntry,
  type PlanTargets,
} from "@/lib/db/mealPlan";
import { isLanguage, languageCookieKey } from "@/lib/i18n";
import { defaultWeekStart } from "@/lib/nutrition/body";
import { resolveWeekStart } from "@/lib/nutrition/plan";
import { requireServerUser } from "@/lib/supabase/requireUser";
import { FoodClient, type FoodTab } from "./FoodClient";

export const dynamic = "force-dynamic";

function nextDay(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

function isDayKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function generateMetadata() {
  return pageMetadata("nav.food");
}

const TABS: FoodTab[] = ["plan", "recipes", "groceries", "foods", "log"];

export default async function FoodPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string | string[];
    day?: string | string[];
    week?: string | string[];
  }>;
}) {
  const { supabase, userId } = await requireServerUser();
  const { tab, day, week } = await searchParams;
  const initialTab: FoodTab = TABS.find((value) => value === tab) ?? "recipes";
  const serverDay = (await getServerLocalDay()) ?? new Date().toISOString().slice(0, 10);
  // A day in the URL is only used when it is a real date that isn't in the future.
  // The device may already be a day ahead of the server's fallback (UTC) day.
  const explicitDay = typeof day === "string" && isDayKey(day) && day <= nextDay(serverDay);
  const logDay = explicitDay ? (day as string) : serverDay;
  const saved = (await cookies()).get(languageCookieKey)?.value;
  const language = isLanguage(saved) ? saved : "en";
  let data: FoodHubData = { recipes: [], foods: [] };
  let foodDay: FoodDay | null = null;
  let weekStartsOn = defaultWeekStart(language);
  let entries: PlanEntry[] = [];
  let targets: PlanTargets = null;
  let initialLoadError = false;
  let planLoadError = false;

  const [hub, log] = await Promise.allSettled([
    loadFoodHub(supabase),
    initialTab === "log" ? loadFoodDay(userId, logDay, supabase) : Promise.resolve(null),
  ]);
  if (hub.status === "fulfilled") data = hub.value;
  else initialLoadError = true;
  // The Log tab refetches on the client when its server load failed.
  if (log.status === "fulfilled") foodDay = log.value;

  try {
    weekStartsOn = await getWeekStartsOn(userId, language, supabase);
  } catch {
    // Fall back to the language default.
  }
  const weekStart = resolveWeekStart(typeof week === "string" ? week : null, serverDay, weekStartsOn);
  // Targets are optional: a failure only hides the comparison, never the plan.
  const [entryResult, targetResult] = await Promise.allSettled([
    loadPlanEntries(weekStart, supabase),
    loadPlanTargets(userId, serverDay, supabase),
  ]);
  if (entryResult.status === "fulfilled") entries = entryResult.value;
  else planLoadError = true;
  if (targetResult.status === "fulfilled") targets = targetResult.value;

  return (
    <FoodClient
      userId={userId}
      initialTab={initialTab}
      initialData={data}
      initialLoadError={initialLoadError}
      serverDay={logDay}
      explicitDay={explicitDay}
      initialFoodDay={foodDay}
      today={serverDay}
      weekStartsOn={weekStartsOn}
      initialWeekStart={weekStart}
      initialEntries={entries}
      targets={targets}
      planLoadError={planLoadError}
    />
  );
}
