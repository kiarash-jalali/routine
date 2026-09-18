import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export class AgentRequestContext {
  private constructor(
    readonly userId: string,
    readonly database: SupabaseClient,
  ) {}
  static async fromRequest(request: Request) {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer "))
      throw new Error("agent_unauthenticated");
    const token = authorization.slice(7);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("agent_configuration_missing");
    // User-scoped JWT preserves RLS. Never substitute the service-role client.
    const database = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error,
    } = await database.auth.getUser(token);
    if (error || !user) throw new Error("agent_unauthenticated");
    return new AgentRequestContext(user.id, database);
  }
}
