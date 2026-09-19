import "server-only";

import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type DatabaseClient = SupabaseClient<Database>;

export type RequestAuthFailure =
  | "server_unavailable"
  | "not_authenticated"
  | "session_invalid";

export type PrivilegedRequestAuth =
  | {
      ok: true;
      accessToken: string;
      user: User;
      supabaseUrl: string;
      anonKey: string;
      userDb: DatabaseClient;
      admin: DatabaseClient;
    }
  | {
      ok: false;
      error: RequestAuthFailure;
    };

export function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}

/**
 * Validates a bearer token with Supabase Auth before returning any privileged
 * server client. Browser pages may use their local session for UX, but API
 * authorization must cross this server-side validation boundary.
 */
export async function authenticatePrivilegedRequest(
  request: Request,
): Promise<PrivilegedRequestAuth> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { ok: false, error: "server_unavailable" };
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return { ok: false, error: "not_authenticated" };
  }

  const userDb = createClient<Database>(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error,
  } = await userDb.auth.getUser(accessToken);

  if (error || !user) {
    return { ok: false, error: "session_invalid" };
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return {
    ok: true,
    accessToken,
    user,
    supabaseUrl,
    anonKey,
    userDb,
    admin,
  };
}
