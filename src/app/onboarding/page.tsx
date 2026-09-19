"use client";

import { useEffect, useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { AnimatedSwap } from "@/components/Motion";
import { BrandMark, Icon, type IconName } from "@/components/Icon";
import { RoutineForm } from "@/components/routines/RoutineForm";
import { LanguagePicker } from "@/components/preferences/LanguagePicker";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import {
  Button,
  LoadingState,
  Card,
  ErrorNotice,
  PageShell,
  SectionHeading,
} from "@/components/ui";
import {
  completeOnboarding,
  getProfile,
  markIntroSeen,
} from "@/lib/db/profile";
import { addRoutine, listRoutines } from "@/lib/db/routines";
import {
  formatPreferredTimeForDatabase,
  getDefaultRoutineFormValues,
} from "@/lib/routineSchedule";
import { getSessionUser } from "@/lib/session";
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

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [userId, setUserId] = useState("");
  const [step, setStep] = useState<"intro" | "routine">("intro");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const user = await getSessionUser();
        if (!user) {
          router.replace("/login");
          return;
        }

        const [profile, existingRoutines] = await Promise.all([
          getProfile(user.id),
          listRoutines(),
        ]);
        if (!profile) throw new Error("profile");

        if (profile.onboarding_completed) {
          router.replace("/dashboard");
          return;
        }

        if (existingRoutines.length > 0) {
          await completeOnboarding(user.id);
          router.replace("/dashboard");
          return;
        }

        if (!cancelled) {
          setUserId(user.id);
          if (profile.intro_seen) setStep("routine");
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

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
      await markIntroSeen(userId);
      setStep("routine");
    });
  }

  function skipSetup() {
    return run(async () => {
      await completeOnboarding(userId);
      router.replace("/dashboard");
    });
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
      await completeOnboarding(userId);
      router.replace("/dashboard");
    });
  }

  if (loading) {
    return (
      <PageShell className="max-w-xl">
        <LoadingState label={t("common.loading")} />
      </PageShell>
    );
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
              {t("onboarding.begin")}
            </Button>
          </Card>
        )}

        {step === "routine" && (
          <Card>
            <SectionHeading
              title={t("onboarding.routine")}
              description={t("onboarding.routineBody")}
            />
            <RoutineForm
              initialValues={getDefaultRoutineFormValues()}
              submitLabel={t("onboarding.addAndStart")}
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
        {t("onboarding.skipAll")}
      </Button>
    </PageShell>
  );
}
