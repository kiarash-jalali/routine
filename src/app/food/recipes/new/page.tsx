import { pageMetadata } from "@/lib/server/pageMetadata";
import { listFoods, type FoodRow } from "@/lib/db/food";
import { requireServerUser } from "@/lib/supabase/requireUser";
import { RecipeEditorPage } from "../RecipeEditorPage";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("food.newRecipe");
}

export default async function NewRecipePage() {
  const { supabase } = await requireServerUser();
  let foods: FoodRow[] = [];
  let loadError = false;
  try {
    foods = await listFoods(supabase);
  } catch {
    loadError = true;
  }
  return <RecipeEditorPage foods={foods} initial={null} loadError={loadError} />;
}
