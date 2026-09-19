import "server-only";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export async function requireServerUser() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (error || !claims || !userId) redirect("/login");

  const email = typeof claims.email === "string" ? claims.email : "";

  return { supabase, userId, email, claims };
}
