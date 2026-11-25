import { pageMetadata } from "@/lib/server/pageMetadata";
import { getServerLocalDay } from "@/lib/server/localDay";
import { requireServerUser } from "@/lib/supabase/requireUser";
import { loadReview, type ReviewData } from "@/lib/db/review";
import { ReviewClient } from "./ReviewClient";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("nav.review");
}

export default async function ReviewPage() {
  const { supabase, userId } = await requireServerUser();
  const day = (await getServerLocalDay()) ?? new Date().toISOString().slice(0, 10);
  let data: ReviewData | null = null;
  try {
    data = await loadReview(userId, day, supabase);
  } catch {
    // The client shows the error; no health values are logged.
  }
  return <ReviewClient userId={userId} initialData={data} />;
}
