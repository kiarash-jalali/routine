import { pageMetadata } from "@/lib/server/pageMetadata";
import { SettingsClient } from "./SettingsClient";
import { getProfile } from "@/lib/db/profile";
import { requireServerUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("nav.settings");
}

export default async function SettingsPage() {
  const { supabase, userId, email } = await requireServerUser();

  let displayName = "";
  let loadError = false;
  try {
    const profile = await getProfile(userId, supabase);
    displayName = profile?.display_name ?? "";
  } catch {
    loadError = true;
  }

  return (
    <SettingsClient
      userId={userId}
      initialDisplayName={displayName}
      initialEmail={email}
      initialLoadError={loadError}
    />
  );
}
