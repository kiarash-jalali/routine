import { FeedbackClient } from "./FeedbackClient";
import { requireServerUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const { userId } = await requireServerUser();
  return <FeedbackClient userId={userId} />;
}
