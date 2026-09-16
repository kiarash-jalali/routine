import { routineIconResponse } from "@/lib/pwaIcon";

export function GET() {
  return routineIconResponse({ size: 192 });
}
