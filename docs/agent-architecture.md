# Planning assistant boundary

Status: readiness only. No provider is configured, no AI route is exposed, no AI write executor exists, and no paid calls run. The ordinary app works independently of this folder.

## Request and data flow

Future review UI → authenticated server route → AgentRequestContext → allowlisted read tools → isolated provider adapter → strict proposal validation → persisted proposal → user review → transactional confirmation RPC → existing domain tables.

`context.ts` validates the Supabase bearer token using `auth.getUser`. Its database client uses that user's JWT, preserving RLS. A model never receives credentials, a database client, a user-selected identity or arbitrary SQL capability. Model output is untrusted; it cannot create authorization or confirmation.

`tools.ts` provides a bounded planning snapshot: routine schedules, up to 100 open tasks, check-in dates, workout plans and bounded session history. A caller requests at most 31 days. Future tools may return deterministic aggregate completion statistics rather than entire records. Tasks/routine titles are untrusted content, not instructions. No medication, medical notes, allergies, health records, account email, push subscriptions or free-text notes enter the snapshot. If health-related content appears in user-provided task titles, the eventual provider must still refuse medical decisions and dosage recommendations.

`contracts.ts` allows only routine creation/rescheduling and workout-plan creation. It rejects unknown fields, cross-user identifiers, oversized batches, invalid schedules and every unlisted action. Deletion, completion records, points, account changes, medication actions, raw SQL and arbitrary HTTP tools are absent. Workout reminders should default off until enabled by the user through the normal UI.

## Explicit confirmation: implementation gate

Before exposing any write endpoint, add a versioned migration for private `agent_proposals` and an action receipt table. Store the authenticated owner, validated canonical actions, action hash, expiry, current row versions and status. Use owner RLS; no model-facing tool can confirm a proposal.

The UI must display every proposed change as a localized before/after review. A user clicks Confirm for that exact persisted proposal. The confirmation endpoint verifies the current session, owner, proposal id, expiry and action hash, then calls one transaction that:

1. Locks the proposal and checks it is pending.
2. Revalidates every action and the current ownership of each target.
3. Checks expected `updated_at` values. A stale proposal returns conflict for renewed review.
4. Applies all accepted changes atomically through the domain layer; never partial unreviewed actions.
5. Records a unique idempotency receipt and marks the proposal applied.

A second click returns the first result; another user, expired proposal, replay or altered action list cannot execute. A model saying “confirmed” or sending `confirmed: true` is not authorization. The `ConfirmedActionExecutor` interface describes this future boundary, not a functioning implementation. Do not replace it with a client flag or a signed token without durable replay protection.

## Provider isolation and operating limits

Implement `PlanningProvider` inside `providers/` and pass only the minimized snapshot. Read unprefixed server environment keys there; keep `server-only` imports. Add per-user rate limits, bounded tool iterations, timeouts/cancellation, a cost budget, provider retention controls and an explicit assistant opt-in before enabling any route. Never put raw prompts, titles, health information, credentials or tool outputs in analytics or logs; log opaque request IDs, tool names, durations and result codes only. Provider-specific SDK types must not escape the adapter.

The first useful release can plan a week or propose a workout schedule. Pattern summaries must distinguish check-ins from completions and avoid diagnosing health, inferring adherence or recommending medication changes. Keep all clinical decisions outside this agent's capabilities.
