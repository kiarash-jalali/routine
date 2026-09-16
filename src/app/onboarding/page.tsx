"use client";

import { useEffect, useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { AnimatedSwap } from "@/components/Motion";
import { BrandMark, Icon } from "@/components/Icon";
import { RoutineForm } from "@/components/routines/RoutineForm";
import {
  Button,
  LoadingState,
  Card,
  ErrorNotice,
  Input,
  PageShell,
  Pill,
  SectionHeading,
} from "@/components/ui";
import {
  completeOnboarding,
  getProfile,
  saveDisplayName,
} from "@/lib/db/profile";
import { addRoutine, listRoutines } from "@/lib/db/routines";
import { getErrorMessage } from "@/lib/errors";
import {
  formatPreferredTimeForDatabase,
  getDefaultRoutineFormValues,
} from "@/lib/routineSchedule";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Routine, RoutineFormValues } from "@/types/routine";

type OnboardingStep = "name" | "routine" | "ready";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [step, setStep] = useState<OnboardingStep>("name");
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routineFormVersion, setRoutineFormVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadOnboarding() {
      try {
        const supabase = supabaseBrowser();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) {
          router.replace("/login");
          return;
        }

        const [profile, existingRoutines] = await Promise.all([
          getProfile(user.id),
          listRoutines(),
        ]);

        if (!profile) {
          throw new Error("Your profile could not be found. Please try again.");
        }

        if (profile.onboarding_completed) {
          router.replace("/dashboard");
          return;
        }

        if (cancelled) return;

        setUserId(user.id);
        setDisplayName(profile.display_name ?? "");
        setRoutines(existingRoutines);

        // A saved routine should not silently advance onboarding after refresh.
        // The user chooses when to leave this step with the Continue button.
        if (profile.display_name) {
          setStep("routine");
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error, "Setup could not be loaded."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOnboarding();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function saveName() {
    if (!userId || !displayName.trim() || saving) return;

    setSaving(true);
    setErrorMessage(null);

    try {
      await saveDisplayName(userId, displayName);
      setDisplayName(displayName.trim());
      setStep("routine");
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Your name could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  async function createRoutine(values: RoutineFormValues) {
    if (!userId || saving) return;

    setSaving(true);
    setErrorMessage(null);

    try {
      await addRoutine({
        user_id: userId,
        title: values.title,
        frequency: values.frequency,
        days_of_week: values.frequency === "weekly" ? values.daysOfWeek : null,
        preferred_time: formatPreferredTimeForDatabase(values.preferredTime),
      });

      setRoutines(await listRoutines());
      setRoutineFormVersion((current) => current + 1);
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(error, "Your routine could not be created."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function finishOnboarding() {
    if (!userId || routines.length === 0 || saving) return;

    setSaving(true);
    setErrorMessage(null);

    try {
      await completeOnboarding(userId);
      router.replace("/dashboard");
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Setup could not be completed."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageShell className="max-w-xl">
        <LoadingState label="Preparing your space…" />
      </PageShell>
    );
  }

  const stepNumber = step === "name" ? 1 : step === "routine" ? 2 : 3;

  return (
    <PageShell className="max-w-xl">
      <div className="mb-8 text-center">
        <BrandMark className="mb-6" />
        <h1 className="display-title text-4xl">Your space, your pace.</h1>
        <p className="mt-3 text-sm text-muted">
          Step {stepNumber} of 3 ·{" "}
          {step === "name"
            ? "A quick hello"
            : step === "routine"
              ? "Your first routine"
              : "All set"}
        </p>
        <div className="onboarding-steps mt-5" aria-hidden="true">
          {[1, 2, 3].map((number) => (
            <span key={number} data-active={number <= stepNumber} />
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="mb-5">
          <ErrorNotice>{errorMessage}</ErrorNotice>
        </div>
      )}

      <AnimatedSwap value={step}>
        {step === "name" && (
          <Card>
            <SectionHeading
              title="What should we call you?"
              description="Let’s start with a name."
            />

            <label className="mt-6 grid gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Your name
              </span>
              <Input
                autoFocus
                disabled={saving}
                autoComplete="given-name"
                maxLength={80}
                placeholder="Your name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveName();
                }}
              />
            </label>

            <Button
              variant="primary"
              className="mt-5 w-full sm:w-auto"
              busy={saving}
              disabled={saving || !displayName.trim()}
              onClick={saveName}
            >
              {saving ? "Saving…" : "Continue"}
              <Icon name="arrow" size={17} />
            </Button>
          </Card>
        )}

        {step === "routine" && (
          <Card>
            <SectionHeading
              title="Start with one small routine."
              description="Choose something that gives your day shape. You can edit, pause, or delete it whenever life changes."
            />

            <Button
              variant="ghost"
              className="mt-3"
              onClick={() => setStep("name")}
              disabled={saving}
            >
              Back
            </Button>
            <RoutineForm
              key={routineFormVersion}
              initialValues={getDefaultRoutineFormValues()}
              submitLabel="Add routine"
              submittingLabel="Adding…"
              isSubmitting={saving}
              onSubmit={createRoutine}
            />

            {routines.length > 0 && (
              <div className="mt-6 border-t border-border pt-5">
                <p className="text-sm font-medium text-foreground">
                  Good start. You can add another or keep it simple.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {routines.map((routine) => (
                    <Pill key={routine.id}>{routine.title}</Pill>
                  ))}
                </div>
                <Button
                  variant="primary"
                  className="mt-5"
                  disabled={saving}
                  onClick={() => setStep("ready")}
                >
                  Continue
                </Button>
              </div>
            )}
          </Card>
        )}

        {step === "ready" && (
          <Card tone="accent">
            <SectionHeading
              title={`You're ready${displayName ? `, ${displayName}` : ""}.`}
              description="Your routines shape the day. The daily check-in records what actually happened — even when the day was imperfect."
            />

            <div className="mt-6 space-y-4 text-sm leading-6 text-muted">
              <p>
                Use <span className="font-medium text-foreground">Today</span>{" "}
                to see what is in front of you. Tasks are for one-off things;
                routines are the repeating parts of your rhythm.
              </p>
              <p>
                At the end of the day, use the daily check-in. Showing up earns
                points once per day, regardless of how many boxes you completed.
              </p>
              <p>
                History is there for perspective, not judgment. Missing a day
                does not erase the work you already did.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="primary"
                busy={saving}
                disabled={saving || routines.length === 0}
                onClick={finishOnboarding}
              >
                {saving ? "Finishing setup…" : "Start today"}
              </Button>
              <Button
                variant="ghost"
                disabled={saving}
                onClick={() => setStep("routine")}
              >
                Add another routine
              </Button>
            </div>
          </Card>
        )}
      </AnimatedSwap>
    </PageShell>
  );
}
