"use client";
import { ReminderPrompt } from "@/components/notifications/ReminderPrompt";
import { claimReminderIntroduction } from "@/lib/db/notifications";
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
  Input,
  PageShell,
  SectionHeading,
} from "@/components/ui";
import {
  completeOnboarding,
  getProfile,
  markIntroSeen,
  saveDisplayName,
} from "@/lib/db/profile";
import { addRoutine, listRoutines } from "@/lib/db/routines";
import {
  formatPreferredTimeForDatabase,
  getDefaultRoutineFormValues,
} from "@/lib/routineSchedule";
import { getSessionUser } from "@/lib/session";
import type { RoutineFormValues } from "@/types/routine";
const screens = [
  {
    title: "intro.welcome",
    body: "intro.welcomeBody",
    items: [
      { key: "task", icon: "today" },
      { key: "routine", icon: "routines" },
    ],
  },
  {
    title: "intro.checkin",
    body: "intro.checkinBody",
    items: [
      { key: "rhythm", icon: "rootine" },
      { key: "points", icon: "spark" },
    ],
  },
  {
    title: "intro.perspective",
    body: "intro.perspectiveBody",
    items: [
      { key: "history", icon: "history" },
      { key: "reminders", icon: "clock" },
    ],
  },
  {
    title: "intro.life",
    body: "intro.lifeBody",
    items: [
      { key: "health", icon: "checkin" },
      { key: "workout", icon: "sun" },
    ],
  },
] as const;
export default function OnboardingPage() {
  const router = useRouter();
  const [reminderOpen, setReminderOpen] = useState(false);
  const { t, number } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<number | "name" | "routine" | "ready">(0);
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
        if (!cancelled) {
          setUserId(user.id);
          setName(profile.display_name ?? "");
          if (profile.intro_seen)
            setStep(
              existingRoutines.length
                ? "ready"
                : profile.display_name
                  ? "routine"
                  : "name",
            );
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
  function finish() {
    return run(async () => {
      await completeOnboarding(userId);
      router.replace("/dashboard");
    });
  }
  function setup() {
    return run(async () => {
      await markIntroSeen(userId);
      setStep("name");
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
      setStep("ready");
      setReminderOpen(await claimReminderIntroduction());
    });
  }
  if (loading)
    return (
      <PageShell className="max-w-xl">
        <LoadingState label={t("common.loading")} />
      </PageShell>
    );
  const intro = typeof step === "number" ? screens[step] : null;
  return (
    <PageShell className="max-w-xl">
      <div className="mb-7 flex items-center justify-between gap-5">
        <BrandMark />
        <LanguagePicker />
      </div>
      {error && <ErrorNotice>{t("common.error")}</ErrorNotice>}
      <AnimatedSwap value={String(step)}>
        {intro && (
          <Card>
            <p className="mb-4 text-sm text-muted">
              {t("intro.progress", { step: number(Number(step) + 1) })}
            </p>
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
            <div className="flex gap-3">
              <Button
                variant="primary"
                busy={busy}
                disabled={busy || !userId}
                onClick={() =>
                  Number(step) < screens.length - 1
                    ? setStep(Number(step) + 1)
                    : void setup()
                }
              >
                {Number(step) < screens.length - 1
                  ? t("common.continue")
                  : t("intro.setup")}
              </Button>
              {Number(step) > 0 && (
                <Button
                  disabled={busy}
                  onClick={() => setStep(Number(step) - 1)}
                >
                  {t("common.back")}
                </Button>
              )}
            </div>
          </Card>
        )}
        {step === "name" && (
          <Card>
            <SectionHeading
              title={t("onboarding.name")}
              description={t("onboarding.nameBody")}
            />
            <form
              className="mt-6 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  if (name.trim()) await saveDisplayName(userId, name);
                  setStep("routine");
                });
              }}
            >
              <label className="grid gap-2">
                {t("common.name")}
                <Input
                  autoComplete="given-name"
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <Button
                type="submit"
                busy={busy}
                disabled={busy}
                variant="primary"
              >
                {t("common.continue")}
              </Button>
            </form>
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
              submitLabel={t("onboarding.add")}
              submittingLabel={t("common.saving")}
              isSubmitting={busy}
              onSubmit={createRoutine}
              shineSubmit
            />
          </Card>
        )}
        {step === "ready" && (
          <Card tone="accent">
            <SectionHeading
              title={t("onboarding.ready")}
              description={t("onboarding.readyBody")}
            />
            <Button
              className="mt-6"
              variant="primary"
              busy={busy}
              disabled={busy}
              onClick={finish}
            >
              {t("onboarding.start")}
            </Button>
          </Card>
        )}
      </AnimatedSwap>
      <Button
        className="mt-5"
        variant="ghost"
        disabled={busy || !userId}
        onClick={finish}
      >
        {t("onboarding.skipAll")}
      </Button>
      <ReminderPrompt
        userId={userId}
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
      />
    </PageShell>
  );
}
