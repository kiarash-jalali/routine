import type { Tables } from "@/types/database";

/** Health data (docs/nutrition-roadmap.md §3): never in push, logs or snapshots. */
export type BodyProfile = Omit<Tables<"body_profiles">, "created_at" | "updated_at">;
export type BodyProfileInput = Omit<BodyProfile, "user_id">;

export type BodyMeasurement = Omit<
  Tables<"body_measurements">,
  "user_id" | "created_at" | "updated_at"
>;
export type MeasurementInput = {
  measured_on: string;
  weight_kg?: number | null;
  waist_cm?: number | null;
  body_fat_pct?: number | null;
  note?: string | null;
};

export type WeighInState = {
  hasProfile: boolean;
  weekStartsOn: number;
  today: Pick<BodyMeasurement, "id" | "weight_kg" | "waist_cm"> | null;
};
