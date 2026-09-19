"use client";

import { useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { AnimatedSwap } from "@/components/Motion";
import { BrandMark, Icon, type IconName } from "@/components/Icon";
import { RoutineForm } from "@/components/routines/RoutineForm";
import { LanguagePicker } from "@/components/preferences/LanguagePicker";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import {
  Button,
  Card,
  ErrorNotice,
  PageShell,
  SectionHeading,
} from "@/components/ui";
import { completeOnboarding, markIntroSeen } from "@/lib/db/profile";
import { addRoutine } from "@/lib/db/routines";
import {
  formatPreferredTimeForDatabase,
  getDefaultRoutineFormValues,
} from "@/lib/routineSchedule";
import { rememberFirstRoutineSuccess } from "@/lib/firstRun";
import type { RoutineFormValues } from "@/types/routine";

const intro = {
  title: "intro.welcome",
  body: "intro.welcomeBody",
  items: [
    { key: "task", icon: "today" },
    { key: "routine", icon: "routines" },
    { key: "checkin", icon: "checkin" },
  ],
} as const;

export function OnboardingClient({
  userId,
  initialStep,
  initialLoadError,
  replay = false,
}: {
  userId: string;
  initialStep: "intro" | "routine";
  initialLoadError: boolean;
  replay?: boolean;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialLoadError);
  const [step, setStep] = useState<"intro" | "routine">(initialStep);
  const [routineDraft, setRoutineDraft] = useState<RoutineFormValues>(
    getDefaultRoutineFormValues,
  );
  const [routineVersion, setRoutineVersion] = useState(0);

  const starterRoutines = [
    { key: "onboarding.presetWater", time: "08:00" },
    { key: "onboarding.presetWalk", time: "18:00" },
    { key: "onboarding.presetRead", time: "21:00" },
    { key: "onboarding.presetStretch", time: "07:30" },
  ] as const;

  async function run(action: () => Promise<void>) {
    if (!userId || busy) return;
    setBusy(true);
    setError(false);

    try {
      await action();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function beginSetup() {
    return run(async () => {
      if (!replay) await markIntroSeen(userId);
      setStep("routine");
    });
  }

  function skipSetup() {
    return run(async () => {
      if (!replay) await completeOnboarding(userId);
      router.replace("/dashboard");
    });
  }

  function chooseStarter(key: (typeof starterRoutines)[number]["key"], time: string) {
    setRoutineDraft({
      ...getDefaultRoutineFormValues(),
      title: t(key),
      preferredTime: time,
    });
    setRoutineVersion((value) => value + 1);
  }

  async function createRoutine(values: RoutineFormValues) {
    await run(async () => {
      await addRoutine({
        user_id: userId,
        title: values.title,
        frequency: values.frequency,
        days_of_week: values.frequency === "weekly" ? values.daysOfWeek : null,
        preferred_time: formatPreferredTimeForDatabase(values.preferredTime),
      });
      rememberFirstRoutineSuccess(values.title);
      if (!replay) await completeOnboarding(userId);
      router.replace("/dashboard");
    });
  }

  return (
    <PageShell className="max-w-xl">
      <div className="mb-7 flex items-center justify-between gap-5">
        <BrandMark />
        <LanguagePicker />
      </div>

      {error && <ErrorNotice>{t("common.error")}</ErrorNotice>}

      <AnimatedSwap value={step}>
        {step === "intro" && (
          <Card>
            <h1 className="display-title text-4xl">{t(intro.title)}</h1>
            <p className="mt-4 text-muted">{t(intro.body)}</p>
            <div className="intro-illustration">
              {intro.items.map((item) => (
                <div key={item.key} className="intro-example">
                  <span className="icon-tile">
                    <Icon name={item.icon as IconName} />
                  </span>
                  <div>
                    <h2 className="font-semibold">{t(`intro.${item.key}`)}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {t(`intro.${item.key}Body`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="primary"
              busy={busy}
              disabled={busy || !userId}
              onClick={() => void beginSetup()}
            >
              {t(replay ? "onboarding.reviewContinue" : "onboarding.begin")}
            </Button>
          </Card>
        )}

        {step === "routine" && (
          <Card>
            <SectionHeading
              title={t("onboarding.routine")}
              description={t("onboarding.routineBody")}
            />
            <div className="mt-5">
              <p className="text-sm font-medium">{t("onboarding.starters")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {starterRoutines.map((preset) => (
                  <Button
                    key={preset.key}
                    variant="ghost"
                    onClick={() => chooseStarter(preset.key, preset.time)}
                    disabled={busy}
                  >
                    {t(preset.key)}
                  </Button>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">
                {t("onboarding.startersBody")}
              </p>
            </div>
            <RoutineForm
              key={routineVersion}
              initialValues={routineDraft}
              submitLabel={t(
                replay ? "onboarding.addAnother" : "onboarding.addAndStart",
              )}
              submittingLabel={t("common.saving")}
              isSubmitting={busy}
              onSubmit={createRoutine}
              shineSubmit
            />
          </Card>
        )}
      </AnimatedSwap>

      <Button
        className="mt-5"
        variant="ghost"
        disabled={busy || !userId}
        onClick={() => void skipSetup()}
      >
        {t(replay ? "onboarding.backToday" : "onboarding.skipAll")}
      </Button>
    </PageShell>
  );
}
