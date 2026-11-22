import { pageMetadata } from "@/lib/server/pageMetadata";
import { getServerLocalDay } from "@/lib/server/localDay";
import { requireServerUser } from "@/lib/supabase/requireUser";
import { loadBody } from "@/lib/db/body";
import { BodyClient } from "./BodyClient";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("nav.body");
}

type BodyData = Awaited<ReturnType<typeof loadBody>>;

export default async function BodyPage() {
  const { supabase, userId } = await requireServerUser();
  const day = (await getServerLocalDay()) ?? new Date().toISOString().slice(0, 10);
  let data: BodyData = { profile: null, measurements: [] };
  let initialLoadError = false;

  try {
    data = await loadBody(userId, day, supabase);
  } catch {
    initialLoadError = true;
  }

  return (
    <BodyClient
      userId={userId}
      serverDay={day}
      initialData={data}
      initialLoadError={initialLoadError}
    />
  );
}
