import "server-only";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export async function requireServerUser() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  const userId =
    typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (error || !userId) redirect("/login");

  const email =
    typeof data.claims.email === "string" ? data.claims.email : "";

  return { supabase, userId, email, claims: data.claims };
}
