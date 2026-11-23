import { pageMetadata } from "@/lib/server/pageMetadata";
import { loadFoodHub, type FoodHubData } from "@/lib/db/food";
import { loadFoodDay, type FoodDay } from "@/lib/db/foodLog";
import { getServerLocalDay } from "@/lib/server/localDay";
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

export default async function FoodPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[]; day?: string | string[] }>;
}) {
  const { supabase, userId } = await requireServerUser();
  const { tab, day } = await searchParams;
  // Plan and Groceries arrive with S4; until then any other value shows Recipes.
  const initialTab: FoodTab = tab === "foods" || tab === "log" ? tab : "recipes";
  const serverDay = (await getServerLocalDay()) ?? new Date().toISOString().slice(0, 10);
  // A day in the URL is only used when it is a real date that isn't in the future.
  // The device may already be a day ahead of the server's fallback (UTC) day.
  const explicitDay = typeof day === "string" && isDayKey(day) && day <= nextDay(serverDay);
  const logDay = explicitDay ? (day as string) : serverDay;
  let data: FoodHubData = { recipes: [], foods: [] };
  let foodDay: FoodDay | null = null;
  let initialLoadError = false;

  const [hub, log] = await Promise.allSettled([
    loadFoodHub(supabase),
    initialTab === "log" ? loadFoodDay(userId, logDay, supabase) : Promise.resolve(null),
  ]);
  if (hub.status === "fulfilled") data = hub.value;
  else initialLoadError = true;
  // The Log tab refetches on the client when its server load failed.
  if (log.status === "fulfilled") foodDay = log.value;

  return (
    <FoodClient
      userId={userId}
      initialTab={initialTab}
      initialData={data}
      initialLoadError={initialLoadError}
      serverDay={logDay}
      explicitDay={explicitDay}
      initialFoodDay={foodDay}
    />
  );
}
