import { pageMetadata } from "@/lib/server/pageMetadata";
import { loadFoodHub, type FoodHubData } from "@/lib/db/food";
import { requireServerUser } from "@/lib/supabase/requireUser";
import { FoodClient, type FoodTab } from "./FoodClient";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("nav.food");
}

export default async function FoodPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { supabase, userId } = await requireServerUser();
  const { tab } = await searchParams;
  // Plan and Groceries arrive with S4; until then any other value shows Recipes.
  const initialTab: FoodTab = tab === "foods" ? "foods" : "recipes";
  let data: FoodHubData = { recipes: [], foods: [] };
  let initialLoadError = false;

  try {
    data = await loadFoodHub(supabase);
  } catch {
    initialLoadError = true;
  }

  return (
    <FoodClient
      userId={userId}
      initialTab={initialTab}
      initialData={data}
      initialLoadError={initialLoadError}
    />
  );
}
