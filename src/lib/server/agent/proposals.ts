import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { planningOutputSchema, type PlanningProposal } from "./contracts";
import type { AgentRequestContext } from "./context";
export function preparePlanningProposal(
  context: AgentRequestContext,
  untrustedOutput: unknown,
  now = new Date(),
): PlanningProposal {
  const { actions } = planningOutputSchema.parse(untrustedOutput);
  return {
    id: randomUUID(),
    userId: context.userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    actionHash: createHash("sha256")
      .update(JSON.stringify(actions))
      .digest("hex"),
    actions,
  };
}
// Deliberately no execute function or public route: persistence and a real review UI
// must exist before these proposals can mutate application data.
