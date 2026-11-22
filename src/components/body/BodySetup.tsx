"use client";

import { useState } from "react";
import { Button, Card, ErrorNotice } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { defaultWeekStart } from "@/lib/nutrition/body";
import {
  BasicsFields,
  GoalFields,
  NumberField,
  ProteinFields,
  RANGES,
  basicsValid,
  draftFromProfile,
  goalValid,
  profileFromDraft,
  proteinValid,
  readNumber,
  type ProfileDraft,
} from "./fields";
import type { BodyProfileInput, MeasurementInput } from "@/types/body";

const STEPS = ["basics", "weight", "goal", "protein"] as const;
type Step = (typeof STEPS)[number];

/**
 * First-visit setup: height and birth year → weight and waist → goal and
 * pace → protein. Only the first step is required; the others can be skipped.
 */
export function BodySetup({
  today,
  busy,
  error,
  onFinish,
}: {
  today: string;
  busy: boolean;
  error: boolean;
  onFinish: (profile: BodyProfileInput, measurement: MeasurementInput | null) => Promise<void>;
}) {
  const { t, number, language } = useLanguage();
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>(() =>
    draftFromProfile(null, defaultWeekStart(language)),
  );
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const step: Step = STEPS[index] ?? "basics";
  const last = index === STEPS.length - 1;

  const change = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const weightValue = readNumber(weight, RANGES.weight);
  const waistValue = readNumber(waist, RANGES.waist);
  const stepValid: Record<Step, boolean> = {
    basics: basicsValid(draft),
    weight: weightValue !== "invalid" && waistValue !== "invalid",
    goal: goalValid(draft),
    protein: proteinValid(draft),
  };

  async function finish(finalDraft: ProfileDraft) {
    const measurement: MeasurementInput = { measured_on: today };
    if (typeof weightValue === "number") measurement.weight_kg = weightValue;
    if (typeof waistValue === "number") measurement.waist_cm = waistValue;
    await onFinish(
      profileFromDraft(finalDraft),
      measurement.weight_kg !== undefined || measurement.waist_cm !== undefined
        ? measurement
        : null,
    );
  }

  function next() {
    if (!stepValid[step]) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    if (last) void finish(draft);
    else setIndex(index + 1);
  }

  function skip() {
    setShowErrors(false);
    // Skipping falls back to the gentle default for that step.
    if (step === "weight") {
      setWeight("");
      setWaist("");
    }
    let skipped = draft;
    if (step === "goal") skipped = { ...draft, goalMode: "maintain", goalWeight: "" };
    if (step === "protein") skipped = { ...draft, proteinMode: "auto", proteinGrams: "" };
    setDraft(skipped);
    if (last) void finish(skipped);
    else setIndex(index + 1);
  }

  const titles: Record<Step, [string, string]> = {
    basics: [t("body.setup.basicsTitle"), t("body.setup.basicsBody")],
    weight: [t("body.setup.weightTitle"), t("body.setup.weightBody")],
    goal: [t("body.setup.goalTitle"), t("body.setup.goalBody")],
    protein: [t("body.setup.proteinTitle"), t("body.setup.proteinBody")],
  };

  return (
    <Card className="mx-auto max-w-xl">
      <div className="onboarding-steps" aria-hidden="true">
        {STEPS.map((name, i) => (
          <span key={name} data-active={i <= index} />
        ))}
      </div>
      <p className="mt-5 text-sm text-muted">
        {t("body.setup.step", {
          current: number(index + 1),
          total: number(STEPS.length),
        })}
      </p>
      <h2 className="display-title mt-1 text-2xl">{titles[step][0]}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{titles[step][1]}</p>
      <form
        noValidate
        className="mt-6 space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          next();
        }}
      >
        <fieldset disabled={busy}>
          {step === "basics" && (
            <BasicsFields draft={draft} change={change} showErrors={showErrors} />
          )}
          {step === "weight" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <NumberField
                label={t("body.weight")}
                value={weight}
                onChange={setWeight}
                range={RANGES.weight}
                showError={showErrors}
              />
              <NumberField
                label={t("body.waist")}
                value={waist}
                onChange={setWaist}
                range={RANGES.waist}
                showError={showErrors}
              />
            </div>
          )}
          {step === "goal" && (
            <GoalFields draft={draft} change={change} showErrors={showErrors} />
          )}
          {step === "protein" && (
            <ProteinFields draft={draft} change={change} showErrors={showErrors} />
          )}
        </fieldset>
        {error && <ErrorNotice>{t("common.error")}</ErrorNotice>}
        <div className="flex flex-wrap gap-3">
          {index > 0 && (
            <Button disabled={busy} onClick={() => setIndex(index - 1)}>
              {t("common.back")}
            </Button>
          )}
          {step !== "basics" && (
            <Button variant="ghost" disabled={busy} onClick={skip}>
              {t("common.skip")}
            </Button>
          )}
          <Button type="submit" variant="primary" className="ms-auto" busy={busy} disabled={busy}>
            {last ? t("body.setup.finish") : t("common.continue")}
          </Button>
        </div>
      </form>
      <p className="mt-6 text-xs leading-5 text-muted">{t("body.privacy")}</p>
    </Card>
  );
}
