import { notFound, redirect } from "next/navigation";
import { pageMetadata } from "@/lib/server/pageMetadata";
import { listFoods, loadRecipe } from "@/lib/db/food";
import { isRecipeId } from "@/lib/nutrition/recipe";
import { requireServerUser } from "@/lib/supabase/requireUser";
import { RecipeEditorPage } from "../../RecipeEditorPage";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("food.editRecipe");
}

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, userId } = await requireServerUser();
  const { id } = await params;
  if (!isRecipeId(id)) notFound();

  let loaded: [Awaited<ReturnType<typeof listFoods>>, Awaited<ReturnType<typeof loadRecipe>>] | null = null;
  try {
    loaded = await Promise.all([listFoods(supabase), loadRecipe(id, supabase)]);
  } catch {
    return <RecipeEditorPage foods={[]} initial={null} loadError editing />;
  }
  const [foods, detail] = loaded;
  if (!detail) notFound();
  // Starter recipes are read-only; editing starts from "Save to my recipes".
  if (detail.recipe.owner_id !== userId) redirect(`/food/recipes/${id}`);
  return <RecipeEditorPage foods={foods} initial={detail} loadError={false} editing />;
}
