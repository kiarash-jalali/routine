"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import {
  BasicsFields,
  GoalFields,
  MoreProfileFields,
  ProteinFields,
  basicsValid,
  draftFromProfile,
  goalValid,
  overrideValid,
  profileFromDraft,
  proteinValid,
  type ProfileDraft,
} from "./fields";
import type { BodyProfile, BodyProfileInput } from "@/types/body";

/** Edit every profile field in one form (setup splits the same fields into steps). */
export function ProfileForm({
  profile,
  busy,
  onSave,
  onCancel,
}: {
  profile: BodyProfile;
  busy: boolean;
  onSave: (values: BodyProfileInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<ProfileDraft>(() =>
    draftFromProfile(profile, profile.week_starts_on),
  );
  const [submitted, setSubmitted] = useState(false);
  const change = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const valid =
    basicsValid(draft) && goalValid(draft) && proteinValid(draft) && overrideValid(draft);

  return (
    <form
      noValidate
      className="mt-5 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (!valid || busy) return;
        void onSave(profileFromDraft(draft));
      }}
    >
      <fieldset disabled={busy} className="space-y-8">
        <BasicsFields draft={draft} change={change} showErrors={submitted} />
        <GoalFields draft={draft} change={change} showErrors={submitted} />
        <ProteinFields draft={draft} change={change} showErrors={submitted} />
        <MoreProfileFields draft={draft} change={change} showErrors={submitted} />
      </fieldset>
      <p className="text-xs leading-5 text-muted">{t("body.notAdvice")}</p>
      <div className="form-actions-sticky flex gap-3">
        <Button onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="primary" busy={busy} disabled={busy}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
