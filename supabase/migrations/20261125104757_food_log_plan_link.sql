-- Nutrition roadmap S5 follow-up: link food log entries to the meal plan (S4).
-- HEALTH DATA (diet): never in push payloads, logs, analytics, the offline
-- snapshot or the planning-agent snapshot.

-- Deleting a planned meal (directly, "Clear week", or with its recipe or food)
-- keeps the logged entry and its snapshot: only meal_plan_entry_id is set null,
-- never user_id. The composite key stops links to another user's plan.
alter table public.food_log_entries
  drop constraint if exists food_log_entries_meal_plan_entry_fkey;
alter table public.food_log_entries
  add constraint food_log_entries_meal_plan_entry_fkey
  foreign key (meal_plan_entry_id, user_id)
  references public.meal_plan_entries(id, user_id)
  on delete set null (meal_plan_entry_id);

-- Covers the FK, and allows one log per planned meal per day (double tap, two
-- devices). A logged meal moved to another day can be logged there.
create unique index if not exists food_log_entries_plan_day_key
  on public.food_log_entries(meal_plan_entry_id, user_id, eaten_on)
  where meal_plan_entry_id is not null;
