import "server-only";
import type { PlanningSnapshot } from "../tools";
export interface PlanningProvider {
  propose(input: {
    request: string;
    snapshot: PlanningSnapshot;
    signal: AbortSignal;
  }): Promise<unknown>;
}
// A future provider implementation lives only in this folder. API keys must be
// unprefixed server environment variables, never NEXT_PUBLIC_*.
