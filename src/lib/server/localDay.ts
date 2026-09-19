import "server-only";

import { cookies } from "next/headers";
import {
  dateKeyInTimeZone,
  isTimeZone,
  ROOTINE_TIMEZONE_COOKIE,
} from "@/lib/timezone";

export async function getServerLocalDay(): Promise<string | null> {
  const cookieStore = await cookies();
  const encoded = cookieStore.get(ROOTINE_TIMEZONE_COOKIE)?.value;
  if (!encoded) return null;

  let timeZone: string;
  try {
    timeZone = decodeURIComponent(encoded);
  } catch {
    return null;
  }

  return isTimeZone(timeZone) ? dateKeyInTimeZone(timeZone) : null;
}
