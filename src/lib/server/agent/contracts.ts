import "server-only";
import { z } from "zod";
const name = z.string().trim().min(1).max(120);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const days = z
  .array(z.number().int().min(1).max(7))
  .min(1)
  .max(7)
  .refine((value) => new Set(value).size === value.length);
const routineSchedule = z.discriminatedUnion("frequency", [
  z
    .object({
      frequency: z.literal("daily"),
      days_of_week: z.null(),
      preferred_time: time,
    })
    .strict(),
  z
    .object({
      frequency: z.literal("weekly"),
      days_of_week: days,
      preferred_time: time,
    })
    .strict(),
]);
// Strict schemas deliberately have no user_id, SQL, URL, medication, deletion or account action.
export const actionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("routine.create"),
      title: name,
      schedule: routineSchedule,
    })
    .strict(),
  z
    .object({
      type: z.literal("routine.reschedule"),
      id: z.uuid(),
      expected_updated_at: z.iso.datetime({ offset: true }),
      schedule: routineSchedule,
    })
    .strict(),
  z
    .object({
      type: z.literal("workout.create"),
      name,
      activity_type: z.string().trim().min(1).max(80),
      duration_minutes: z.number().int().min(1).max(1440),
      days_of_week: days,
      preferred_time: time,
      timezone: z
        .string()
        .max(100)
        .refine((value) => {
          try {
            new Intl.DateTimeFormat("en", { timeZone: value });
            return true;
          } catch {
            return false;
          }
        }),
    })
    .strict(),
]);
export const planningOutputSchema = z
  .object({ actions: z.array(actionSchema).max(10) })
  .strict();
export type ProposedAction = z.infer<typeof actionSchema>;
export type PlanningProposal = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  actionHash: string;
  actions: ProposedAction[];
};
// Future persistence MUST be durable and transactional. A client boolean is not confirmation.
export interface ConfirmedActionExecutor {
  execute(input: {
    authenticatedUserId: string;
    proposalId: string;
    expectedActionHash: string;
    idempotencyKey: string;
  }): Promise<
    | { status: "applied"; resultIds: string[] }
    | { status: "expired" | "conflict" | "already_applied" | "not_found" }
  >;
}
