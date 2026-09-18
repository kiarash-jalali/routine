import assert from "node:assert/strict";
import test from "node:test";
import { planningOutputSchema } from "../src/lib/server/agent/contracts";
const valid = {
  type: "routine.create",
  title: "Read",
  schedule: { frequency: "daily", days_of_week: null, preferred_time: "09:00" },
};
test("only explicitly allowed, bounded proposals pass", () => {
  assert.equal(
    planningOutputSchema.safeParse({ actions: [valid] }).success,
    true,
  );
  for (const actions of [
    [{ type: "medication.update", dose: "20 mg" }],
    [{ ...valid, user_id: "someone-else" }],
    Array(11).fill(valid),
    [
      {
        ...valid,
        schedule: {
          frequency: "weekly",
          days_of_week: [],
          preferred_time: "09:00",
        },
      },
    ],
    [
      {
        ...valid,
        schedule: {
          frequency: "daily",
          days_of_week: null,
          preferred_time: "25:00",
        },
      },
    ],
  ])
    assert.equal(planningOutputSchema.safeParse({ actions }).success, false);
});
