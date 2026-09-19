import { SettingsClient } from "./SettingsClient";
import { getProfile } from "@/lib/db/profile";
import { requireServerUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabase, userId, email } = await requireServerUser();

  try {
    const profile = await getProfile(userId, supabase);
    return (
      <SettingsClient
        userId={userId}
        initialDisplayName={profile?.display_name ?? ""}
        initialEmail={email}
        initialLoadError={false}
      />
    );
  } catch {
    return (
      <SettingsClient
        userId={userId}
        initialDisplayName=""
        initialEmail={email}
        initialLoadError
      />
    );
  }
}
