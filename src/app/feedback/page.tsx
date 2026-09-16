"use client";

import { useEffect, useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import {
  Button,
  Card,
  ErrorNotice,
  LoadingState,
  PageHeader,
  PageShell,
  SectionHeading,
  Select,
} from "@/components/ui";
import {
  submitFeedback,
  type FeedbackCategory,
} from "@/lib/db/feedback";
import { getErrorMessage } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabaseClient";

const feedbackCategories: ReadonlyArray<{
  value: FeedbackCategory;
  label: string;
}> = [
  { value: "friction", label: "Something felt confusing or awkward" },
  { value: "bug", label: "Something broke" },
  { value: "idea", label: "Idea or request" },
  { value: "other", label: "Something else" },
];

export default function FeedbackPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>("friction");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const {
        data: { user },
        error: userError,
      } = await supabaseBrowser().auth.getUser();

      if (cancelled) return;
      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setLoading(false);
    }

    void loadUser();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!userId || submitting || trimmedMessage.length < 3) return;

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await submitFeedback(userId, category, trimmedMessage);
      setMessage("");
      setNotice("Thanks — your feedback was saved.");
    } catch (submitError: unknown) {
      setError(
        getErrorMessage(submitError, "Your feedback could not be sent. Try again."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PageShell className="max-w-3xl">
        <LoadingState label="Opening feedback…" />
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        eyebrow="Private alpha"
        title="Tell us what felt off."
        description="While Routine is small, the most useful feedback is what interrupted your flow, confused you, or made you wish something worked differently."
      />

      {(error || notice) && (
        <div className="mb-6" aria-live="polite">
          {error ? (
            <ErrorNotice>{error}</ErrorNotice>
          ) : (
            <div className="notice rounded-2xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground">
              {notice}
            </div>
          )}
        </div>
      )}

      <Card>
        <SectionHeading
          title="Send feedback"
          description="Short and specific is perfect. You do not need to write a formal bug report."
        />

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-medium">
            What kind of feedback is this?
            <Select
              value={category}
              disabled={submitting}
              onChange={(event) =>
                setCategory(event.target.value as FeedbackCategory)
              }
            >
              {feedbackCategories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-2 text-sm font-medium">
            What happened?
            <textarea
              className="field min-h-36 resize-y"
              value={message}
              minLength={3}
              maxLength={2000}
              placeholder="For example: I tried to edit my routine and expected…"
              disabled={submitting}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">{message.length}/2000</p>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || message.trim().length < 3}
              busy={submitting}
            >
              Send feedback
            </Button>
          </div>
        </form>
      </Card>
    </PageShell>
  );
}
