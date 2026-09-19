"use client";

import { useEffect, useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import {
  MomentPopup,
  MomentSource,
  type MomentNotice,
} from "@/components/MomentPopup";
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
import { getMomentCopy } from "@/lib/moments";
import { getSessionUser } from "@/lib/session";

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
  const [moment, setMoment] = useState<MomentNotice | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const user = await getSessionUser();

      if (cancelled) return;
      if (!user) {
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

    try {
      await submitFeedback(userId, category, trimmedMessage);
      setMessage("");
      const copy = getMomentCopy("feedback_sent");
      setMoment({
        id: `feedback-${Date.now()}`,
        ...copy,
        sourceId: "send-feedback",
        icon: "mail",
        tone: "warm",
        durationMs: 3400,
      });
    } catch (submitError: unknown) {
      setError(
        getErrorMessage(submitError, t("feedback.failed")),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PageShell className="max-w-3xl">
        <LoadingState label={t("feedback.loading")} />
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

      {error && (
        <div className="mb-6">
          <ErrorNotice>{error}</ErrorNotice>
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
              placeholder={t("feedback.placeholder")}
              disabled={submitting}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">{message.length}/2000</p>
            <MomentSource id="send-feedback">
              <Button
                type="submit"
                variant="primary"
                disabled={submitting || message.trim().length < 3}
                busy={submitting}
              >
                Send feedback
              </Button>
            </MomentSource>
          </div>
        </form>
      </Card>

      <MomentPopup notice={moment} onDismiss={() => setMoment(null)} />
    </PageShell>
  );
}
