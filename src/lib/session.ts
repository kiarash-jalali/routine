import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabaseClient";

/**
 * Browser-page session lookup. This normally reads the local Supabase session,
 * avoiding an auth-server request before page data can start loading.
 * Authorization remains enforced by Postgres RLS and by server-side token
 * validation on privileged API routes.
 */
export async function getSessionUser(): Promise<User | null> {
  const {
    data: { session },
    error,
  } = await supabaseBrowser().auth.getSession();

  if (error) throw error;
  return session?.user ?? null;
}
