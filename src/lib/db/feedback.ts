import { supabaseBrowser } from "@/lib/supabaseClient";

export type FeedbackCategory = "bug" | "friction" | "idea" | "other";

export async function submitFeedback(
  userId: string,
  category: FeedbackCategory,
  message: string,
): Promise<void> {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) return;

  const { error } = await supabaseBrowser().from("feedback").insert({
    user_id: userId,
    category,
    message: trimmedMessage,
  });

  if (error) throw error;
}
