import { redirect } from "next/navigation";
import { OnboardingClient } from "./OnboardingClient";
import { getProfile } from "@/lib/db/profile";
import { listRoutines } from "@/lib/db/routines";
import { requireServerUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ replay?: string }>;
}) {
  const { supabase, userId } = await requireServerUser();
  const replay = (await searchParams).replay === "1";

  try {
    const [profile, routines] = await Promise.all([
      getProfile(userId, supabase),
      listRoutines(supabase),
    ]);

    if (!profile) {
      return (
        <OnboardingClient
          userId={userId}
          initialStep="intro"
          initialLoadError
        />
      );
    }

    if (profile.onboarding_completed && !replay) redirect("/dashboard");

    if (routines.length > 0 && !replay) {
      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          intro_seen: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      if (error) throw error;
      redirect("/dashboard");
    }

    return (
      <OnboardingClient
        userId={userId}
        initialStep={profile.intro_seen ? "routine" : "intro"}
        initialLoadError={false}
        replay={replay}
      />
    );
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return (
      <OnboardingClient
        userId={userId}
        initialStep="intro"
        initialLoadError
      />
    );
  }
}
