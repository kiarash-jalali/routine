import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/server/pageMetadata";
import { loadRecipe, type RecipeDetail } from "@/lib/db/food";
import { isRecipeId } from "@/lib/nutrition/recipe";
import { requireServerUser } from "@/lib/supabase/requireUser";
import { RecipeDetailClient } from "./RecipeDetailClient";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("food.recipeTitle");
}

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, userId } = await requireServerUser();
  const { id } = await params;
  if (!isRecipeId(id)) notFound();

  let detail: RecipeDetail | null = null;
  let loadError = false;
  try {
    detail = await loadRecipe(id, supabase);
  } catch {
    loadError = true;
  }
  if (!loadError && !detail) notFound();

  return <RecipeDetailClient userId={userId} detail={detail} loadError={loadError} />;
}
