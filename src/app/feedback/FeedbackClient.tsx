"use client";

import { useState } from "react";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import {
  MomentPopup,
  MomentSource,
  type MomentNotice,
} from "@/components/MomentPopup";
import {
  Button,
  Card,
  ErrorNotice,
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
import type { TranslationKey } from "@/lib/i18n";

const feedbackCategories = [
  { value: "friction", labelKey: "feedback.friction" },
  { value: "bug", labelKey: "feedback.bug" },
  { value: "idea", labelKey: "feedback.idea" },
  { value: "other", labelKey: "feedback.other" },
] as const satisfies ReadonlyArray<{
  value: FeedbackCategory;
  labelKey: TranslationKey;
}>;

export function FeedbackClient({ userId }: { userId: string }) {
  const { t, number } = useLanguage();
  const [category, setCategory] = useState<FeedbackCategory>("friction");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moment, setMoment] = useState<MomentNotice | null>(null);

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

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        eyebrow={t("feedback.eyebrow")}
        title={t("feedback.title")}
        description={t("feedback.body")}
      />

      {error && (
        <div className="mb-6">
          <ErrorNotice>{error}</ErrorNotice>
        </div>
      )}

      <Card>
        <SectionHeading
          title={t("feedback.send")}
          description={t("feedback.sendBody")}
        />

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-medium">
            {t("feedback.kind")}
            <Select
              value={category}
              disabled={submitting}
              onChange={(event) =>
                setCategory(event.target.value as FeedbackCategory)
              }
            >
              {feedbackCategories.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-2 text-sm font-medium">
            {t("feedback.happened")}
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
            <p className="text-xs text-muted">{t("feedback.characterCount", { count: number(message.length), max: number(2000) })}</p>
            <MomentSource id="send-feedback">
              <Button
                type="submit"
                variant="primary"
                disabled={submitting || message.trim().length < 3}
                busy={submitting}
              >
                {t("feedback.send")}
              </Button>
            </MomentSource>
          </div>
        </form>
      </Card>

      <MomentPopup notice={moment} onDismiss={() => setMoment(null)} />
    </PageShell>
  );
}
