import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function enforceRateLimit(
  admin: SupabaseClient<Database>,
  bucket: string,
  subject: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const subjectHash = createHash("sha256")
    .update(`${bucket}:${subject}`)
    .digest("hex");

  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    p_bucket: bucket,
    p_subject_hash: subjectHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) throw new Error("rate_limit_unavailable");
  return data === true;
}

// x-forwarded-for is trustworthy only when the request terminates at a known
// proxy such as Vercel's edge. Never use this value as the sole authorization
// boundary; pair IP rate limiting with authentication, a shared secret, or a
// second non-IP abuse cap.
export function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
